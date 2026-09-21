-- Ancillary deposits: money in that belongs to neither the betting pool nor an
-- equity allocation. Tracked, but it must not reach the sync trigger.

alter type public.capital_deposit_kind add value if not exists 'ancillary';
