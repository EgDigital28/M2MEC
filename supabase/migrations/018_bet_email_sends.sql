-- Ledger email send history (upcoming plays, yesterday's results, weekly summary).

create type public.bet_email_type as enum (
  'upcoming_plays',
  'yesterdays_results',
  'weekly_summary'
);

create table if not exists public.bet_email_sends (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null default gen_random_uuid(),
  email_type public.bet_email_type not null,
  recipient_email text not null,
  sent_by uuid references public.profiles (id) on delete set null,
  sent_at timestamptz not null default now(),
  sent_on_date date not null,
  play_count integer not null default 0 check (play_count >= 0),
  context_date date,
  context_week_end date
);

create index if not exists bet_email_sends_sent_at_idx
  on public.bet_email_sends (sent_at desc);

create index if not exists bet_email_sends_type_recipient_date_idx
  on public.bet_email_sends (email_type, lower(recipient_email), sent_on_date);

create index if not exists bet_email_sends_batch_id_idx
  on public.bet_email_sends (batch_id);

alter table public.bet_email_sends enable row level security;

drop policy if exists "Admins manage bet email sends" on public.bet_email_sends;
create policy "Admins manage bet email sends"
  on public.bet_email_sends
  for all
  using (public.is_admin())
  with check (public.is_admin());
