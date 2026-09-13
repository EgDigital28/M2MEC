-- User suspensions: block login and re-registration for suspended emails.

alter table public.profiles
  add column if not exists suspended_at timestamptz;

create table if not exists public.suspended_emails (
  email text primary key,
  suspended_at timestamptz not null default now(),
  suspended_by uuid references auth.users (id) on delete set null,
  notes text
);

create unique index if not exists suspended_emails_email_lower_idx
  on public.suspended_emails (lower(email));

alter table public.suspended_emails enable row level security;

-- Prevent new auth users from getting a profile when their email is suspended.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.suspended_emails
    where lower(email) = lower(new.email)
  ) then
    raise exception 'This email is suspended and cannot register.';
  end if;

  insert into public.profiles (id, email, tier)
  values (new.id, new.email, 'b');

  return new;
end;
$$;
