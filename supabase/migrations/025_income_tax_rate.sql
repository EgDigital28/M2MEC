-- Recognised income is reported net of tax. The rate is per contract so a
-- future contract can differ without touching the ones already recorded.

alter table public.income_contracts
  add column if not exists tax_rate numeric(5, 4) not null default 0.30
    check (tax_rate >= 0 and tax_rate < 1);
