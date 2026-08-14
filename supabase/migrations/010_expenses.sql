-- Admin expense tracking: cost centers, components, and line items.
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT where possible.

create table if not exists public.expense_cost_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint expense_cost_centers_name_unique unique (name)
);

create table if not exists public.expense_components (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint expense_components_name_unique unique (name)
);

create table if not exists public.expense_entries (
  id uuid primary key default gen_random_uuid(),
  cost_center_id uuid not null references public.expense_cost_centers (id) on delete restrict,
  component_id uuid not null references public.expense_components (id) on delete restrict,
  amount numeric(12, 2) not null check (amount >= 0),
  expense_date date not null,
  quarter text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expense_entries_expense_date_idx
  on public.expense_entries (expense_date desc);

create index if not exists expense_entries_quarter_idx
  on public.expense_entries (quarter desc);

create or replace function public.set_expense_quarter()
returns trigger
language plpgsql
as $$
begin
  new.quarter :=
    (floor((extract(month from new.expense_date) - 1) / 3) + 1)::int::text
    || 'Q'
    || lpad((extract(year from new.expense_date)::int % 100)::text, 2, '0');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists expense_entries_set_quarter on public.expense_entries;

create trigger expense_entries_set_quarter
  before insert or update of expense_date, cost_center_id, component_id, amount, notes
  on public.expense_entries
  for each row
  execute function public.set_expense_quarter();

alter table public.expense_cost_centers enable row level security;
alter table public.expense_components enable row level security;
alter table public.expense_entries enable row level security;

drop policy if exists "Admins manage expense cost centers" on public.expense_cost_centers;
create policy "Admins manage expense cost centers"
  on public.expense_cost_centers
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins manage expense components" on public.expense_components;
create policy "Admins manage expense components"
  on public.expense_components
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins manage expense entries" on public.expense_entries;
create policy "Admins manage expense entries"
  on public.expense_entries
  for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.expense_cost_centers (name, sort_order)
values
  ('Data', 1),
  ('Development', 2),
  ('Software', 3),
  ('Hosting', 4),
  ('Other', 5)
on conflict (name) do nothing;

insert into public.expense_components (name, sort_order)
values
  ('Model', 1),
  ('ESPN', 2),
  ('Sportsbook Hub', 3),
  ('Picks', 4),
  ('Cashout', 5),
  ('AI Consultant', 6)
on conflict (name) do nothing;
