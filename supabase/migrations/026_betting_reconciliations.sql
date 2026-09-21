-- Betting reconciliation payments: cash settled with an individual outside the
-- wager ledger. A positive amount is paid out to them, a negative amount is
-- collected from them, so one table covers both directions.

create table if not exists public.betting_reconciliations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  paid_on date not null,
  amount numeric(14, 2) not null check (amount <> 0),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists betting_reconciliations_profile_idx
  on public.betting_reconciliations (profile_id, paid_on desc);

create index if not exists betting_reconciliations_paid_on_idx
  on public.betting_reconciliations (paid_on desc);

alter table public.betting_reconciliations enable row level security;

drop policy if exists "Admins manage betting reconciliations" on public.betting_reconciliations;
create policy "Admins manage betting reconciliations"
  on public.betting_reconciliations
  for all
  using (public.is_admin())
  with check (public.is_admin());
