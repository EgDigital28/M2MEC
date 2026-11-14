-- Recorded from the database (supabase_migrations, version 20260929163844):
-- applied directly on 2026-09-29 and never committed. Files Dana White's
-- Contender Series cards under UFC and replays the bets it had refused.
begin;
set local lock_timeout='5s';
do $repair$
declare
 definition text:=pg_get_functiondef('public.project_ledger_bet(uuid)'::regprocedure);
 mapping_anchor text:=$old$or (lower(btrim(leg->>'sport'))='mma'
   and lower(btrim(coalesce(leg->>'league',''))) ~ '^ufc([[:space:]]|[0-9]|:|$)'
   and m.league='ufc'))$old$;
begin
 if cardinality(string_to_array(definition,mapping_anchor))<>2 then
  raise exception 'Ledger Bet projection predecessor drift';
 end if;
 definition:=replace(definition,mapping_anchor,$new$or (lower(btrim(leg->>'sport'))='mma'
   and (lower(btrim(coalesce(leg->>'league',''))) ~ '^ufc([[:space:]]|[0-9]|:|$)'
    or lower(btrim(coalesce(leg->>'league',''))) ~ '^dana white[''’]s contender series([[:space:]:]|$)')
   and m.league='ufc'))$new$);
 execute definition;
end $repair$;
do $replay$
declare affected record;
begin
 for affected in
  select e.entity_id
  from public.creator_partner_entities e
  join public.ledger_bet_projection_errors err on err.entity_id=e.entity_id
  where e.source='thepredictionledger' and e.entity_type='bet'
    and err.error_code='sport_mapping_required'
    and jsonb_array_length(coalesce(e.record->'legs','[]'::jsonb))=1
    and lower(btrim(e.record#>>'{legs,0,sport}'))='mma'
    and lower(btrim(e.record#>>'{legs,0,league}')) ~ '^dana white[''’]s contender series([[:space:]:]|$)'
 loop
  perform public.project_ledger_bet(affected.entity_id);
 end loop;
end $replay$;
commit;
