-- Deposits become entries rather than a single editable number.
--
-- equity_stakes.deposit and wagering_stakes.capital_deposit are kept, but as
-- caches maintained by trigger from these rows: a dozen readers already depend
-- on those columns, and rewriting them all to aggregate on every read would be
-- churn for no gain. The entries are the source of truth; the columns follow.

create type public.capital_deposit_kind as enum ('company', 'betting');

create table if not exists public.capital_deposits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind public.capital_deposit_kind not null,
  deposited_on date not null,
  amount numeric(14, 2) not null check (amount > 0),
  description text check (char_length(description) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists capital_deposits_profile_kind_idx
  on public.capital_deposits (profile_id, kind, deposited_on desc);

alter table public.capital_deposits enable row level security;

drop policy if exists "Admins manage capital deposits" on public.capital_deposits;
create policy "Admins manage capital deposits"
  on public.capital_deposits
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Opening entries so the derived totals match what is on screen today. Dated
-- from when each stake was created, which is the closest honest date available.
insert into public.capital_deposits (profile_id, kind, deposited_on, amount, description)
select e.profile_id, 'company', e.created_at::date, e.deposit, 'Opening balance'
from public.equity_stakes e
where e.profile_id is not null and e.deposit > 0
  and not exists (
    select 1 from public.capital_deposits d
    where d.profile_id = e.profile_id and d.kind = 'company'
  );

insert into public.capital_deposits (profile_id, kind, deposited_on, amount, description)
select w.profile_id, 'betting', w.created_at::date, w.capital_deposit, 'Opening balance'
from public.wagering_stakes w
where w.profile_id is not null and w.capital_deposit > 0
  and not exists (
    select 1 from public.capital_deposits d
    where d.profile_id = w.profile_id and d.kind = 'betting'
  );

-- NOTE: betting totals are applied to every wagering stake held by the profile.
-- That is correct while a single wagering group exists; a second group would
-- need group_id carried on the deposit row.
create or replace function public.sync_capital_deposit_totals()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  target_kind public.capital_deposit_kind;
begin
  foreach target in array (
    case when tg_op = 'INSERT' then array[new.profile_id]
         when tg_op = 'DELETE' then array[old.profile_id]
         else array[old.profile_id, new.profile_id] end
  ) loop
    target_kind := case when tg_op = 'DELETE' then old.kind else new.kind end;

    if target_kind = 'company' then
      update public.equity_stakes s
      set deposit = coalesce((
            select sum(d.amount) from public.capital_deposits d
            where d.profile_id = target and d.kind = 'company'), 0),
          updated_at = now()
      where s.profile_id = target;
    else
      update public.wagering_stakes s
      set capital_deposit = coalesce((
            select sum(d.amount) from public.capital_deposits d
            where d.profile_id = target and d.kind = 'betting'), 0),
          updated_at = now()
      where s.profile_id = target;
    end if;
  end loop;

  return null;
end $$;

revoke all on function public.sync_capital_deposit_totals() from public, anon, authenticated;

drop trigger if exists capital_deposits_sync on public.capital_deposits;
create trigger capital_deposits_sync
  after insert or update or delete on public.capital_deposits
  for each row execute function public.sync_capital_deposit_totals();
