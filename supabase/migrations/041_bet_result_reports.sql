-- What each person was told about each play in a results email.
--
-- The results email no longer holds back when grading is late: at its last
-- attempt it goes out with ungraded plays shown as Open. A play reported Open
-- to someone is owed to them: once it is graded it appears in their next
-- results email under "Graded since last email", and is recorded again with
-- its result so it is not repeated.
create table if not exists public.bet_result_reports (
  bet_entry_id uuid not null references public.bet_entries (id) on delete cascade,
  recipient_email text not null check (recipient_email = lower(recipient_email)),
  results_date date not null,
  reported_status text not null check (reported_status in ('Open','Win','Loss','Void')),
  reported_at timestamptz not null default now(),
  primary key (bet_entry_id, recipient_email, results_date)
);

create index if not exists bet_result_reports_open_idx
  on public.bet_result_reports (recipient_email)
  where reported_status = 'Open';

alter table public.bet_result_reports enable row level security;

drop policy if exists "Admins manage result reports" on public.bet_result_reports;
create policy "Admins manage result reports" on public.bet_result_reports
  for all using (public.is_admin()) with check (public.is_admin());
