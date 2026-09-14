-- Admit explicit Bet entities to the existing admin-only, versioned receiver.
-- No viewer provisioning, RLS expansion, existing bet_entries writes or backfill.
begin;
set local lock_timeout='5s';
alter table public.creator_partner_entities drop constraint creator_partner_entities_entity_type_check;
alter table public.creator_partner_entities add constraint creator_partner_entities_entity_type_check check(entity_type in ('pick','package','bet'));
alter table public.creator_partner_receipts drop constraint creator_partner_receipts_entity_type_check;
alter table public.creator_partner_receipts add constraint creator_partner_receipts_entity_type_check check(entity_type in ('pick','package','bet'));
create or replace function public.accept_creator_partner_event(p_event jsonb,p_digest text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_event_id uuid := (p_event->>'eventId')::uuid;
  v_entity_id uuid := (p_event->>'entityId')::uuid;
  v_creator_id uuid := (p_event->>'creatorId')::uuid;
  version bigint := (p_event->>'entityVersion')::bigint;
  kind text := p_event->>'entityType';
  prior public.creator_partner_receipts%rowtype;
  current_entity public.creator_partner_entities%rowtype;
  outcome text := 'applied';
begin
  if p_event->>'schemaVersion' is distinct from 'ledger-creator-partner@1'
    or p_event->>'source' is distinct from 'thepredictionledger'
    or kind is null or kind not in ('pick','package','bet') or v_event_id is null or v_entity_id is null or v_creator_id is null
    or version is null or version<1 or p_digest is null or p_digest !~ '^[a-f0-9]{64}$'
    or p_event#>>'{record,id}' is distinct from v_entity_id::text
    or p_event#>>'{record,creator,id}' is distinct from v_creator_id::text
    or (case when kind='bet' then p_event#>>'{record,bet,id}' is distinct from v_entity_id::text or p_event#>>'{record,visibility}' is distinct from 'private' or p_event#>>'{record,recordKind}' is distinct from 'bet' else p_event#>>'{record,visibility}' is null or p_event#>>'{record,visibility}' not in ('public','premium') end)
    or jsonb_typeof(p_event->'record') is distinct from 'object'
  then raise exception 'Invalid partner event'; end if;
  perform pg_advisory_xact_lock(hashtextextended('creator-event:'||v_event_id::text,0));
  select * into prior from public.creator_partner_receipts r where r.event_id=v_event_id;
  if found then
    if prior.body_digest<>p_digest then raise exception 'Partner event ID payload conflict'; end if;
    return jsonb_build_object('receiptId',prior.event_id,'outcome',prior.outcome,'duplicate',true);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('creator-entity:'||kind||':'||v_entity_id::text,0));
  select * into current_entity from public.creator_partner_entities e
    where e.source='thepredictionledger' and e.entity_type=kind and e.entity_id=v_entity_id for update;
  if found then
    if current_entity.creator_id<>v_creator_id then raise exception 'Partner creator identity conflict'; end if;
    if current_entity.entity_version=version and current_entity.body_digest<>p_digest then
      raise exception 'Partner entity version conflict';
    end if;
    if current_entity.entity_version>=version then outcome:='ignored_stale'; end if;
  end if;
  if outcome='applied' then
    insert into public.creator_partner_entities(source,entity_type,entity_id,creator_id,entity_version,event_id,body_digest,record,occurred_at)
    values('thepredictionledger',kind,v_entity_id,v_creator_id,version,v_event_id,p_digest,p_event->'record',(p_event->>'occurredAt')::timestamptz)
    on conflict(source,entity_type,entity_id) do update set
      entity_version=excluded.entity_version,event_id=excluded.event_id,body_digest=excluded.body_digest,
      record=excluded.record,occurred_at=excluded.occurred_at,received_at=now();
  end if;
  insert into public.creator_partner_receipts(event_id,source,entity_type,entity_id,creator_id,entity_version,body_digest,envelope,outcome)
  values(v_event_id,'thepredictionledger',kind,v_entity_id,v_creator_id,version,p_digest,p_event,outcome);
  return jsonb_build_object('receiptId',v_event_id,'outcome',outcome,'duplicate',false);
end $$;
revoke all on function public.accept_creator_partner_event(jsonb,text) from public,anon,authenticated;
grant execute on function public.accept_creator_partner_event(jsonb,text) to service_role;

notify pgrst,'reload schema';
commit;
