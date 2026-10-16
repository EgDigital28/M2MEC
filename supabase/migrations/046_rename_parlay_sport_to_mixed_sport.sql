-- Mixed-sport parlays read "Mixed Sport" rather than "Parlay". The sport row
-- and its multi_sport/parlay mapping are unchanged; only the label moves.
update public.sports
set abbreviation = 'Mixed Sport', full_name = 'Mixed-sport parlay', updated_at = now()
where abbreviation = 'Parlay';
