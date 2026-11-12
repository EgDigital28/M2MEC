-- The first college basketball bets of the season (Nov 7) were stored but
-- refused: College Basketball was inactive and had no Ledger mapping. The
-- Ledger sends men's college basketball as sport and league
-- "mens_college_basketball".
update public.sports set is_active = true, updated_at = now() where abbreviation = 'CBB';

insert into public.ledger_sport_mappings (sport, league, sport_id)
select v.sport, v.league, s.id
from (values ('mens_college_basketball', 'mens_college_basketball')) as v(sport, league)
cross join public.sports s
where s.abbreviation = 'CBB'
  and not exists (select 1 from public.ledger_sport_mappings m where m.sport = v.sport and m.league = v.league);
