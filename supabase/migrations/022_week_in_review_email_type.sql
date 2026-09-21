-- Track Week in Review sends alongside the other ledger emails.
-- ALTER TYPE ... ADD VALUE must not be used in the same transaction that
-- creates it, so this migration only widens the enum.

alter type public.bet_email_type add value if not exists 'week_in_review';
