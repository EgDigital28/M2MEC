-- Admin waitlist access + invite activity log.

create table public.invite_events (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  tier public.user_tier not null,
  profile_id uuid references public.profiles (id) on delete set null,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index invite_events_email_lower_idx
  on public.invite_events (lower(email));

create index invite_events_created_at_idx
  on public.invite_events (created_at desc);

alter table public.invite_events enable row level security;

create policy "Admins can read invite events"
  on public.invite_events
  for select
  using (public.is_admin());

create policy "Admins can manage waitlist"
  on public.waitlist_submissions
  for all
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.sync_waitlist_on_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.registered_at is not null
    and (old.registered_at is null or old.registered_at is distinct from new.registered_at) then
    update public.waitlist_submissions
    set status = 'converted'
    where lower(email) = lower(new.email)
      and status <> 'converted';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_sync_waitlist_on_registration on public.profiles;

create trigger profiles_sync_waitlist_on_registration
  after update of registered_at on public.profiles
  for each row
  execute function public.sync_waitlist_on_registration();
