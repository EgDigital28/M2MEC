-- The games behind each Ledger bet, kept on the bet itself so the ledger page
-- and emails can show "Event: Carolina Panthers vs Cleveland Browns · Sep 27,
-- 1:00 PM ET" without reading the raw feed, which only allowlisted admins may.
-- One entry per game in leg order; a same-game parlay lists its game once.
begin;
set local lock_timeout='5s';
alter table public.bet_entries add column if not exists ledger_events jsonb;
create function public.ledger_bet_events(p_entity uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('eventName',g.leg->>'eventName','startsAt',g.leg->>'startsAt') order by g.n),'[]'::jsonb)
 from (select distinct on (coalesce(l.leg->>'eventId',l.n::text)) l.leg,l.n
  from public.creator_partner_entities e cross join lateral jsonb_array_elements(e.record->'legs') with ordinality l(leg,n)
  where e.source='thepredictionledger' and e.entity_type='bet' and e.entity_id=p_entity
  order by coalesce(l.leg->>'eventId',l.n::text),l.n) g;
$$;
revoke all on function public.ledger_bet_events(uuid) from public,anon,authenticated;
grant execute on function public.ledger_bet_events(uuid) to service_role;
-- Filled on every projected insert or update. Only the projection roles fill
-- it: anyone else touching a Ledger row is refused by guard_ledger_bet, and
-- must keep getting that refusal rather than a permissions error from here.
create function public.fill_ledger_bet_events() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.ledger_entity_id is not null and current_user in ('service_role','postgres') then
  new.ledger_events:=public.ledger_bet_events(new.ledger_entity_id);
 end if;
 return new;
end $$;
create trigger ledger_bet_events before insert or update on public.bet_entries
for each row execute function public.fill_ledger_bet_events();
update public.bet_entries set ledger_events=public.ledger_bet_events(ledger_entity_id) where ledger_entity_id is not null;
commit;
