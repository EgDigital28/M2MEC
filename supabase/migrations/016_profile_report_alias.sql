-- Admin-set short label for reports (e.g. I1-EG).

alter table public.profiles
  add column if not exists report_alias text;

alter table public.profiles
  drop constraint if exists profiles_report_alias_length;

alter table public.profiles
  add constraint profiles_report_alias_length
  check (report_alias is null or char_length(trim(report_alias)) between 1 and 32);
