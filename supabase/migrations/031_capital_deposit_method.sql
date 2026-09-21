-- How the money arrived. Defaulting to wire backfills every existing row,
-- which is what they were.

alter table public.capital_deposits
  add column if not exists method text not null default 'wire';

alter table public.capital_deposits
  drop constraint if exists capital_deposits_method_check;
alter table public.capital_deposits
  add constraint capital_deposits_method_check
  check (method in (
    'wire', 'cash', 'check', 'ach', 'zelle', 'venmo',
    'cashapp', 'paypal', 'apple_pay', 'crypto', 'other'
  ));

create index if not exists capital_deposits_method_idx
  on public.capital_deposits (method);
