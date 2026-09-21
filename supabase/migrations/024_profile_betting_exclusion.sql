-- Some investors hold equity but deliberately take no part in the betting
-- pool. Without a flag that is indistinguishable from a stake nobody has
-- entered yet, so record it explicitly.

alter table public.profiles
  add column if not exists excluded_from_betting boolean not null default false;

update public.profiles
set excluded_from_betting = true
where report_alias = 'I3-SC';
