-- On/off switches for the scheduled emails, managed from the Email
-- automation page. One row per automated email type.
--
-- Seeded so nothing changes on deploy: yesterday's results was already
-- sending, so it starts on; today's plays is new, so it starts off until the
-- owner turns it on.

create table if not exists public.email_automation_settings (
  email_type text primary key,
  enabled boolean not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.email_automation_settings (email_type, enabled)
values ('yesterdays_results', true), ('upcoming_plays', false)
on conflict (email_type) do nothing;

alter table public.email_automation_settings enable row level security;

drop policy if exists "Admins manage email automation" on public.email_automation_settings;
create policy "Admins manage email automation" on public.email_automation_settings
  for all using (public.is_admin()) with check (public.is_admin());
