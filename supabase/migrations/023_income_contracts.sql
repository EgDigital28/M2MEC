-- Recognised income from annual contracts. Recognition is derived from the
-- contract term rather than stored, so a corrected start date or annual value
-- re-derives every period instead of leaving stale rows behind.

create table if not exists public.income_contracts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  counterparty text check (char_length(counterparty) <= 120),
  annual_amount numeric(14, 2) not null check (annual_amount >= 0),
  start_date date not null,
  -- Null means the contract continues indefinitely and every later year
  -- recognises the full annual amount.
  end_date date check (end_date is null or end_date >= start_date),
  is_active boolean not null default true,
  notes text check (char_length(notes) <= 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists income_contracts_start_date_idx
  on public.income_contracts (start_date);

alter table public.income_contracts enable row level security;

drop policy if exists "Admins manage income contracts" on public.income_contracts;
create policy "Admins manage income contracts"
  on public.income_contracts
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- First contract: ESPN, annual, signed 2026-09-10. 2026 is prorated by days,
-- 2027 recognises the full annual amount.
insert into public.income_contracts (name, counterparty, annual_amount, start_date, notes)
select 'ESPN', 'ESPN', 400000, date '2026-09-10',
       'Annual contract. 2026 prorated from Sep 10; full annual amount thereafter.'
where not exists (select 1 from public.income_contracts where name = 'ESPN');
