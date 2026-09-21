-- Only betting deposits carry a wagering group; company and ancillary never do.
alter table public.capital_deposits
  drop constraint if exists capital_deposits_group_scope;
alter table public.capital_deposits
  add constraint capital_deposits_group_scope
  check ((kind = 'betting') = (group_id is not null));

-- Skip kinds that are not tied to a stake, rather than letting them fall
-- through to the betting branch.
create or replace function public.sync_capital_deposit_totals()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  rec record;
begin
  for rec in
    select * from (
      select case when tg_op = 'DELETE' then old.profile_id else new.profile_id end as profile_id,
             case when tg_op = 'DELETE' then old.kind else new.kind end as kind,
             case when tg_op = 'DELETE' then old.group_id else new.group_id end as group_id
      union
      select old.profile_id, old.kind, old.group_id
      where tg_op = 'UPDATE'
    ) t
  loop
    if rec.kind = 'company' then
      update public.equity_stakes s
      set deposit = coalesce((
            select sum(d.amount) from public.capital_deposits d
            where d.profile_id = rec.profile_id and d.kind = 'company'), 0),
          updated_at = now()
      where s.profile_id = rec.profile_id;
    elsif rec.kind = 'betting' then
      update public.wagering_stakes s
      set capital_deposit = coalesce((
            select sum(d.amount) from public.capital_deposits d
            where d.profile_id = rec.profile_id
              and d.kind = 'betting'
              and d.group_id = rec.group_id), 0),
          updated_at = now()
      where s.profile_id = rec.profile_id and s.group_id = rec.group_id;
    end if;
  end loop;

  return null;
end $$;

revoke all on function public.sync_capital_deposit_totals() from public, anon, authenticated;
