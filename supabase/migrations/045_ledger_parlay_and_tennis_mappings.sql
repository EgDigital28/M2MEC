-- Two Ledger bets on Oct 16 were stored but never reached the ledger:
--
-- * A parlay mixing sports (UFC + NFL). project_ledger_bet files those under
--   the multi_sport/parlay mapping, which was never created because every
--   earlier parlay was single-sport. Mixed-sport parlays now have their own
--   "Parlay" sport; single-sport parlays keep filing under their sport.
-- * The first tennis bet. The Ledger sends the tournament ("Rolex Shanghai
--   Masters") as the league, not the tour, so each tournament is mapped to
--   ATP or WTA as it first appears. Shanghai Masters is an ATP event.
--
-- Mapping keys are lower case, as project_ledger_bet compares them.
insert into public.sports (abbreviation, full_name, is_active, sort_order)
select 'Parlay', 'Multi-sport parlay', true, 18
where not exists (select 1 from public.sports where abbreviation = 'Parlay');

insert into public.ledger_sport_mappings (sport, league, sport_id)
select 'multi_sport', 'parlay', s.id from public.sports s
where s.abbreviation = 'Parlay'
  and not exists (select 1 from public.ledger_sport_mappings where sport = 'multi_sport' and league = 'parlay');

insert into public.ledger_sport_mappings (sport, league, sport_id)
select 'tennis', 'rolex shanghai masters', s.id from public.sports s
where s.abbreviation = 'Tennis (ATP)'
  and not exists (select 1 from public.ledger_sport_mappings where sport = 'tennis' and league = 'rolex shanghai masters');
