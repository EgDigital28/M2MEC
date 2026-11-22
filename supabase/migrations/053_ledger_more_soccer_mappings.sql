-- La Liga, Bundesliga and Champions League, mapped ahead of their first bets.
-- No bet in these leagues had arrived yet, so the Ledger's exact league keys
-- are unknown; the Premier League arrived as sport "soccer", league "epl".
-- Each league is mapped under its likely spellings (short codes, full names,
-- underscored forms and ESPN slugs); unused rows are harmless. A key that is
-- still missed shows in ledger_bet_projection_errors as sport_mapping_required.
insert into public.ledger_sport_mappings (sport, league, sport_id)
select 'soccer', v.league, s.id
from (values
  ('la_liga', 'Soccer (La Liga)'), ('laliga', 'Soccer (La Liga)'), ('la liga', 'Soccer (La Liga)'), ('esp.1', 'Soccer (La Liga)'),
  ('bundesliga', 'Soccer (Bundesliga)'), ('german_bundesliga', 'Soccer (Bundesliga)'), ('german bundesliga', 'Soccer (Bundesliga)'), ('ger.1', 'Soccer (Bundesliga)'),
  ('ucl', 'Soccer (CL)'), ('champions_league', 'Soccer (CL)'), ('champions league', 'Soccer (CL)'),
  ('uefa_champions_league', 'Soccer (CL)'), ('uefa champions league', 'Soccer (CL)'), ('uefa.champions', 'Soccer (CL)')
) as v(league, abbreviation)
join public.sports s on s.abbreviation = v.abbreviation
where not exists (select 1 from public.ledger_sport_mappings m where m.sport = 'soccer' and m.league = v.league);
