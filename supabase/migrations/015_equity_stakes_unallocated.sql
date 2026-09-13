-- Allow equity stakes without an assigned investor ("Un-Allocated").
-- When a profile is deleted, linked stakes become un-allocated.

alter table public.equity_stakes
  drop constraint if exists equity_stakes_profile_id_fkey;

alter table public.equity_stakes
  alter column profile_id drop not null;

alter table public.equity_stakes
  add constraint equity_stakes_profile_id_fkey
  foreign key (profile_id)
  references public.profiles (id)
  on delete set null;
