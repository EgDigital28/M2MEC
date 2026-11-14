-- The first PFL bet (a two-fight parlay, Nov 14) was stored but refused: M2MEC
-- had no PFL sport. Like UFC, the Ledger sends each PFL card's title as the
-- league ("PFL Dubai: Nemkov vs. Bilostenniy"), so any MMA league starting
-- "PFL" files under the new PFL sport, the same way UFC cards file under UFC.
-- Builds on 20260929163844_map_ledger_contender_series.sql; raises if that
-- text has drifted.
insert into public.sports (abbreviation, full_name, is_active, sort_order)
select 'PFL', 'Professional Fighters League', true, 19
where not exists (select 1 from public.sports where abbreviation = 'PFL');

insert into public.ledger_sport_mappings (sport, league, sport_id)
select 'mma', 'pfl', s.id from public.sports s
where s.abbreviation = 'PFL'
  and not exists (select 1 from public.ledger_sport_mappings where sport = 'mma' and league = 'pfl');

do $repair$
declare
 definition text:=pg_get_functiondef('public.project_ledger_bet(uuid)'::regprocedure);
 mapping_anchor text:=$old$
   and m.league='ufc'))$old$;
begin
 if cardinality(string_to_array(definition,mapping_anchor))<>2 then
  raise exception 'Ledger Bet projection predecessor drift';
 end if;
 definition:=replace(definition,mapping_anchor,$new$
   and m.league='ufc')
  or (lower(btrim(leg->>'sport'))='mma'
   and lower(btrim(coalesce(leg->>'league',''))) ~ '^pfl([[:space:]]|[0-9]|:|$)'
   and m.league='pfl'))$new$);
 execute definition;
end $repair$;
