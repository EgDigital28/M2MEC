-- Payment reminders are logged with the other emails, so they show in Send
-- history and get the same "already sent today" warning.
alter type public.bet_email_type add value if not exists 'payment_reminder';
