-- Wagering stake groups and investor wagering stakes.

create table if not exists public.wagering_stake_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wagering_stake_groups_name_unique unique (name)
);

create table if not exists public.wagering_stakes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  group_id uuid not null references public.wagering_stake_groups (id) on delete restrict,
  capital_deposit numeric(12, 2) not null check (capital_deposit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists wagering_stakes_profile_group_unique
  on public.wagering_stakes (group_id, profile_id)
  where profile_id is not null;

create index if not exists wagering_stakes_group_id_idx
  on public.wagering_stakes (group_id);

create index if not exists wagering_stakes_profile_id_idx
  on public.wagering_stakes (profile_id);

alter table public.wagering_stake_groups enable row level security;
alter table public.wagering_stakes enable row level security;

drop policy if exists "Admins manage wagering stake groups" on public.wagering_stake_groups;
create policy "Admins manage wagering stake groups"
  on public.wagering_stake_groups
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins manage wagering stakes" on public.wagering_stakes;
create policy "Admins manage wagering stakes"
  on public.wagering_stakes
  for all
  using (public.is_admin())
  with check (public.is_admin());
