-- Equity stake tracking for registered investors and admin users.

create table if not exists public.equity_stakes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete restrict,
  io_allocation numeric(5, 2) not null check (io_allocation > 0 and io_allocation <= 100),
  io_cash_value numeric(12, 2) not null check (io_cash_value >= 0),
  deposit numeric(12, 2) not null default 0 check (deposit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equity_stakes_profile_unique unique (profile_id)
);

create index if not exists equity_stakes_profile_id_idx
  on public.equity_stakes (profile_id);

alter table public.equity_stakes enable row level security;

drop policy if exists "Admins manage equity stakes" on public.equity_stakes;
create policy "Admins manage equity stakes"
  on public.equity_stakes
  for all
  using (public.is_admin())
  with check (public.is_admin());
