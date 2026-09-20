-- Distinguish scheduled ledger emails from ones an admin sent by hand.
-- Existing rows predate the cron job, so false is the correct backfill.

alter table public.bet_email_sends
  add column if not exists is_automated boolean not null default false;

create index if not exists bet_email_sends_automated_idx
  on public.bet_email_sends (is_automated, sent_on_date);
