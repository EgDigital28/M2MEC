-- The first NBA bets of the season (Oct 20) were stored but refused: the NBA
-- sport was inactive and had no Ledger mapping. The Ledger sends NBA as
-- sport "nba", league "nba"; "basketball"/"nba" is mapped too, matching how
-- WNBA is covered under both.
update public.sports set is_active = true, updated_at = now() where abbreviation = 'NBA';

insert into public.ledger_sport_mappings (sport, league, sport_id)
select v.sport, v.league, s.id
from (values ('nba', 'nba'), ('basketball', 'nba')) as v(sport, league)
cross join public.sports s
where s.abbreviation = 'NBA'
  and not exists (select 1 from public.ledger_sport_mappings m where m.sport = v.sport and m.league = v.league);
