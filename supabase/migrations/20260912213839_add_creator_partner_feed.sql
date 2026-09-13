-- Prediction Ledger's authenticated, versioned Creator feed.
-- Lock: new tables and functions only; existing bet_entries are not touched.
-- Rollback: disable the receiver and retain feed entities/receipts for audit.
begin;

create table public.creator_feed_viewers (
  user_id uuid primary key references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.creator_feed_viewers enable row level security;
revoke all on public.creator_feed_viewers from public,anon,authenticated,service_role;
create policy creator_feed_viewer_self on public.creator_feed_viewers
  for select to authenticated using(user_id=auth.uid());
grant select on public.creator_feed_viewers to authenticated;
grant select,insert,delete on public.creator_feed_viewers to service_role;

create table public.creator_partner_entities (
  source text not null check(source='thepredictionledger'),
  entity_type text not null check(entity_type in ('pick','package')),
  entity_id uuid not null,
  creator_id uuid not null,
  entity_version bigint not null check(entity_version>0),
  event_id uuid not null,
  body_digest text not null check(body_digest ~ '^[a-f0-9]{64}$'),
  record jsonb not null check(jsonb_typeof(record)='object'),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  primary key(source,entity_type,entity_id)
);
create index creator_partner_entities_received_idx on public.creator_partner_entities(received_at desc,entity_id);
alter table public.creator_partner_entities enable row level security;
revoke all on public.creator_partner_entities from public,anon,authenticated,service_role;
create policy creator_partner_entities_admin_viewer on public.creator_partner_entities
  for select to authenticated using(
    exists(select 1 from public.creator_feed_viewers v join public.profiles p on p.id=v.user_id
      where v.user_id=auth.uid() and p.tier='admin' and p.suspended_at is null)
  );
grant select on public.creator_partner_entities to authenticated;
grant select,insert,update on public.creator_partner_entities to service_role;

create table public.creator_partner_receipts (
  event_id uuid primary key,
  source text not null check(source='thepredictionledger'),
  entity_type text not null check(entity_type in ('pick','package')),
  entity_id uuid not null,
  creator_id uuid not null,
  entity_version bigint not null check(entity_version>0),
  body_digest text not null check(body_digest ~ '^[a-f0-9]{64}$'),
  envelope jsonb not null,
  outcome text not null check(outcome in ('applied','ignored_stale')),
  received_at timestamptz not null default now()
);
create index creator_partner_receipts_entity_idx on public.creator_partner_receipts(entity_id,entity_version desc);
alter table public.creator_partner_receipts enable row level security;
revoke all on public.creator_partner_receipts from public,anon,authenticated,service_role;
create policy creator_partner_receipts_admin_viewer on public.creator_partner_receipts
  for select to authenticated using(
    exists(select 1 from public.creator_feed_viewers v join public.profiles p on p.id=v.user_id
      where v.user_id=auth.uid() and p.tier='admin' and p.suspended_at is null)
  );
grant select on public.creator_partner_receipts to authenticated;
grant select,insert on public.creator_partner_receipts to service_role;

create function public.accept_creator_partner_event(p_event jsonb,p_digest text)
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
    or kind not in ('pick','package') or v_event_id is null or v_entity_id is null or v_creator_id is null
    or version is null or version<1 or p_digest is null or p_digest !~ '^[a-f0-9]{64}$'
    or p_event#>>'{record,id}' is distinct from v_entity_id::text
    or p_event#>>'{record,creator,id}' is distinct from v_creator_id::text
    or p_event#>>'{record,visibility}' not in ('public','premium')
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

-- Viewer provisioning is a separately recorded, exact-user operation by the
-- Deployment Coordinator. The schema grants no user initial feed access.
notify pgrst,'reload schema';
commit;
