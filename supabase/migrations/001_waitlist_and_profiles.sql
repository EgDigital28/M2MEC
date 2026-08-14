-- Waitlist (early access form — not auth users)
create table public.waitlist_submissions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  message text not null,
  status text not null default 'pending'
    check (status in ('pending', 'welcomed', 'invited', 'converted')),
  welcome_email_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index waitlist_submissions_email_lower_idx
  on public.waitlist_submissions (lower(email));

alter table public.waitlist_submissions enable row level security;

-- User tiers for authenticated accounts (set manually in Supabase for now)
create type public.user_tier as enum ('employee', 'a', 'b', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  tier public.user_tier not null default 'b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Auto-create a profile when a user is created in Supabase Auth (manual invites).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, tier)
  values (new.id, new.email, 'b');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
