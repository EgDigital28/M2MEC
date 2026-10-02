-- Each game on a Ledger bet now carries its result, once the Ledger has one:
-- the leg's settlement facts (scores, or for other markets their own facts),
-- with the participant labels the Ledger graded against. Only proven results
-- are kept: an "original" or "reconstructed" fact. Pending and unproven ones
-- are left out, so a game line only turns into a result when there is one.
-- Rendering lives in the app, so new result kinds need no further migration.
begin;
set local lock_timeout='5s';
create or replace function public.ledger_bet_events(p_entity uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'eventName',g.leg->>'eventName',
   'startsAt',g.leg->>'startsAt',
   'result',case when g.leg->'settlement'->>'status' in ('original','reconstructed') then jsonb_build_object(
     'status',g.leg->'settlement'->>'status',
     'marketType',g.leg->>'marketType',
     'selection',g.leg->>'selection',
     'observed',g.leg->'settlement'->'observed',
     'source',g.leg->'settlement'->'source') end
  ) order by g.n),'[]'::jsonb)
 from (select distinct on (coalesce(l.leg->>'eventId',l.n::text)) l.leg,l.n
  from public.creator_partner_entities e cross join lateral jsonb_array_elements(e.record->'legs') with ordinality l(leg,n)
  where e.source='thepredictionledger' and e.entity_type='bet' and e.entity_id=p_entity
  -- Within one game, prefer a leg that already has a proven result.
  order by coalesce(l.leg->>'eventId',l.n::text),
   (l.leg->'settlement'->>'status' in ('original','reconstructed')) is not true,l.n) g;
$$;
revoke all on function public.ledger_bet_events(uuid) from public,anon,authenticated;
grant execute on function public.ledger_bet_events(uuid) to service_role;
update public.bet_entries set ledger_events=public.ledger_bet_events(ledger_entity_id) where ledger_entity_id is not null;
commit;
