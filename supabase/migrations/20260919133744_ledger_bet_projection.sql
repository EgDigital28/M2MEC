begin;
set local lock_timeout='5s';
alter table public.bet_entries add column ledger_entity_id uuid unique, add column ledger_version bigint,
 add column ledger_profit_loss numeric, add column ledger_to_win numeric;
alter table public.bet_entries alter column created_by drop not null;
alter table public.bet_entries drop constraint bet_entries_risk_check;
alter table public.bet_entries add constraint bet_entries_risk_check check(risk>0 or (ledger_entity_id is not null and risk=0));
alter table public.bet_entries add constraint bet_entries_owner_check check(created_by is not null or ledger_entity_id is not null);
create table public.ledger_sport_mappings (
 sport text not null, league text not null, sport_id uuid not null references public.sports(id), primary key(sport,league)
);
create table public.ledger_bet_projection_errors (
 entity_id uuid primary key, entity_version bigint not null, error_code text not null, updated_at timestamptz not null default now()
);
alter table public.ledger_sport_mappings enable row level security;
alter table public.ledger_bet_projection_errors enable row level security;
revoke all on public.ledger_sport_mappings,public.ledger_bet_projection_errors from public,anon,authenticated;
grant all on public.ledger_sport_mappings,public.ledger_bet_projection_errors to service_role;

-- Enforced even for a direct database/API write by an M2MEC administrator.
create function public.guard_ledger_bet() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user not in ('service_role','postgres') and
 ((tg_op<>'INSERT' and old.ledger_entity_id is not null) or (tg_op<>'DELETE' and new.ledger_entity_id is not null)) then
 raise exception 'Ledger bets are read-only; corrections and grading come from Ledger' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function public.guard_ledger_bet() from public,anon,authenticated;
create trigger ledger_bet_read_only before insert or update or delete on public.bet_entries for each row execute function public.guard_ledger_bet();

create function public.project_ledger_bet(p_entity uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare e public.creator_partner_entities%rowtype; r jsonb; leg jsonb; mapped uuid; chosen uuid; multi boolean:=false;
 label text:=''; grade text; cash numeric; bonus numeric; odds numeric; net numeric; win numeric;
begin
 select * into e from public.creator_partner_entities where source='thepredictionledger' and entity_type='bet' and entity_id=p_entity for update;
 if not found then return false;end if;
 begin
 r:=e.record;
 if r#>>'{bet,currency}' is distinct from 'USD' then raise exception 'unsupported_currency';end if;
 if jsonb_array_length(r->'legs')<1 then raise exception 'missing_legs';end if;
 for leg in select value from jsonb_array_elements(r->'legs') loop
 select m.sport_id into mapped from public.ledger_sport_mappings m join public.sports s on s.id=m.sport_id and s.is_active
 where m.sport=lower(leg->>'sport') and m.league=lower(coalesce(leg->>'league',''));
 if mapped is null then raise exception 'sport_mapping_required';end if;
 if chosen is not null and chosen<>mapped then multi:=true;end if;chosen:=mapped;
 label:=concat_ws(' + ',nullif(label,''),concat(leg->>'eventName',' · ',leg->>'selection',' ',leg->>'marketType',' ',leg->>'line',' · ',leg->>'period'));
 end loop;
 if multi then
 select sport_id into chosen from public.ledger_sport_mappings where sport='multi_sport' and league='parlay';
 if chosen is null then raise exception 'parlay_mapping_required';end if;
 end if;
 cash:=(r#>>'{bet,cashStake}')::numeric;bonus:=(r#>>'{bet,bonusStake}')::numeric;odds:=(r->>'oddsAmerican')::numeric;
 if cash is null or bonus is null or cash<0 or bonus<0 or abs(odds)<100 or odds is null then raise exception 'invalid_receipt_amounts';end if;
 win:=(cash+bonus)*case when odds<0 then 100/abs(odds) else odds/100 end;
 grade:=case r->>'grade' when 'won' then 'Win' when 'lost' then 'Loss' when 'push' then 'Void' when 'void' then 'Void' else 'Open' end;
 if r->>'publicationStatus' in ('retracted','voided') then grade:='Void';end if;
 net:=case when grade in ('Open','Void') then 0 else coalesce((r#>>'{bet,settledNet}')::numeric,case grade when 'Win' then win when 'Loss' then -cash else 0 end) end;
 insert into public.bet_entries(created_by,event_date,sport_id,event_name,line,risk,status,ledger_entity_id,ledger_version,ledger_profit_loss,ledger_to_win)
 values(null,((r#>>'{bet,placedAt}')::timestamptz at time zone 'America/New_York')::date,chosen,label,odds,cash,grade,e.entity_id,e.entity_version,net,win)
 on conflict(ledger_entity_id) do update set event_date=excluded.event_date,sport_id=excluded.sport_id,event_name=excluded.event_name,line=excluded.line,risk=excluded.risk,status=excluded.status,ledger_version=excluded.ledger_version,ledger_profit_loss=excluded.ledger_profit_loss,ledger_to_win=excluded.ledger_to_win,updated_at=now()
 where public.bet_entries.ledger_version<excluded.ledger_version;
 delete from public.ledger_bet_projection_errors where entity_id=e.entity_id;
 return true;
 exception when others then
 insert into public.ledger_bet_projection_errors(entity_id,entity_version,error_code) values(e.entity_id,e.entity_version,
 case when sqlerrm in ('unsupported_currency','missing_legs','sport_mapping_required','parlay_mapping_required','invalid_receipt_amounts') then sqlerrm else 'invalid_ledger_receipt' end)
 on conflict(entity_id) do update set entity_version=excluded.entity_version,error_code=excluded.error_code,updated_at=now();
 return false;
 end;
end $$;
revoke all on function public.project_ledger_bet(uuid) from public,anon,authenticated;
grant execute on function public.project_ledger_bet(uuid) to service_role;
create function public.capture_ledger_bet() returns trigger language plpgsql security invoker set search_path='' as $$
begin if new.entity_type='bet' then perform public.project_ledger_bet(new.entity_id);end if;return new;end $$;
revoke all on function public.capture_ledger_bet() from public,anon,authenticated;
create trigger creator_entity_bet_projection after insert or update on public.creator_partner_entities for each row execute function public.capture_ledger_bet();

-- One importer invocation at a time; lease exceeds the 60-second route deadline.
create table public.ledger_consumer_lease(id boolean primary key default true check(id),owner uuid,expires_at timestamptz);
insert into public.ledger_consumer_lease(id) values(true);
alter table public.ledger_consumer_lease enable row level security;
revoke all on public.ledger_consumer_lease from public,anon,authenticated;
grant select,update on public.ledger_consumer_lease to service_role;
create function public.claim_ledger_consumer(p_owner uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.ledger_consumer_lease set owner=p_owner,expires_at=clock_timestamp()+interval '75 seconds'
 where id and (expires_at is null or expires_at<clock_timestamp());return found;
end $$;
create function public.release_ledger_consumer(p_owner uuid) returns void language sql security invoker set search_path='' as $$
 update public.ledger_consumer_lease set owner=null,expires_at=null where id and owner=p_owner;
$$;
revoke all on function public.claim_ledger_consumer(uuid),public.release_ledger_consumer(uuid) from public,anon,authenticated;
grant execute on function public.claim_ledger_consumer(uuid),public.release_ledger_consumer(uuid) to service_role;

commit;
