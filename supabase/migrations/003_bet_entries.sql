-- Bet ledger entries (Sportsbook Hub v1)
-- Requires 004_sports.sql to be run first.
create table public.bet_entries (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  event_date date not null,
  sport_id uuid not null references public.sports (id),
  event_name text not null,
  line numeric not null,
  risk numeric not null check (risk > 0),
  status text not null default 'Open'
    check (status in ('Open', 'Win', 'Loss', 'Void')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bet_entries_event_date_idx on public.bet_entries (event_date desc);

alter table public.bet_entries enable row level security;

create policy "Team can read bet entries"
  on public.bet_entries
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.tier in ('employee', 'admin')
    )
  );

create policy "Admins can insert bet entries"
  on public.bet_entries
  for insert
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.tier = 'admin'
    )
    and created_by = auth.uid()
  );

create policy "Admins can update bet entries"
  on public.bet_entries
  for update
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.tier = 'admin'
    )
  );

create policy "Admins can delete bet entries"
  on public.bet_entries
  for delete
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.tier = 'admin'
    )
  );
