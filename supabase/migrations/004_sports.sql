-- Sports catalog for bet ledger (run BEFORE 003_bet_entries.sql)
create table if not exists public.sports (
  id uuid primary key default gen_random_uuid(),
  abbreviation text not null,
  full_name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sports_abbreviation_unique unique (abbreviation)
);

create index if not exists sports_sort_order_idx on public.sports (sort_order, abbreviation);

alter table public.sports enable row level security;

drop policy if exists "Team can read sports" on public.sports;
create policy "Team can read sports"
  on public.sports
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.tier in ('employee', 'admin')
    )
  );

drop policy if exists "Admins can insert sports" on public.sports;
create policy "Admins can insert sports"
  on public.sports
  for insert
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.tier = 'admin'
    )
  );

drop policy if exists "Admins can update sports" on public.sports;
create policy "Admins can update sports"
  on public.sports
  for update
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.tier = 'admin'
    )
  );

drop policy if exists "Admins can delete sports" on public.sports;
create policy "Admins can delete sports"
  on public.sports
  for delete
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.tier = 'admin'
    )
  );

-- Seed current sport list (active = shown in ledger dropdown by default)
insert into public.sports (abbreviation, full_name, is_active, sort_order)
values
  ('UFC', 'Ultimate Fighting Championship', true, 1),
  ('NFL', 'National Football League', false, 2),
  ('CFB', 'College Football', false, 3),
  ('MLB', 'Major League Baseball', true, 4),
  ('NBA', 'National Basketball Association', false, 5),
  ('CBB', 'College Basketball', false, 6),
  ('NHL', 'National Hockey League', false, 7),
  ('Tennis (ATP)', 'ATP Tour', true, 8),
  ('Tennis (WTA)', 'WTA Tour', true, 9),
  ('Soccer (EPL)', 'English Premier League', false, 10),
  ('Soccer (Bundesliga)', 'German Bundesliga', false, 11),
  ('Soccer (La Liga)', 'La Liga', false, 12),
  ('Soccer (CL)', 'UEFA Champions League', false, 13),
  ('Soccer (Other)', 'Soccer (Other)', false, 14),
  ('Boxing', 'Boxing', false, 15),
  ('WNBA', 'Women''s National Basketball Association', false, 16),
  ('CBB (W)', 'Women''s College Basketball', false, 17)
on conflict (abbreviation) do nothing;
