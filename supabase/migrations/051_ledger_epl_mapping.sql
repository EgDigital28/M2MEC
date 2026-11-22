-- The first Premier League bet (Nov 22, Man United vs Liverpool both teams to
-- score) was stored but refused: the Ledger sends sport "soccer", league
-- "epl", which had no mapping. The Soccer (EPL) sport was already active.
insert into public.ledger_sport_mappings (sport, league, sport_id)
select 'soccer', 'epl', s.id from public.sports s
where s.abbreviation = 'Soccer (EPL)'
  and not exists (select 1 from public.ledger_sport_mappings where sport = 'soccer' and league = 'epl');
