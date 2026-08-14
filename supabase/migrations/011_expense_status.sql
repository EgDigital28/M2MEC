-- Expense line item status: invoiced, paid, forecasted, void.
-- Safe to re-run.

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'expense_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.expense_status as enum ('invoiced', 'paid', 'forecasted', 'void');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expense_entries'
      and column_name = 'status'
  ) then
    alter table public.expense_entries
      add column status public.expense_status not null default 'forecasted';

    update public.expense_entries
    set status = case
      when expense_date > current_date then 'forecasted'::public.expense_status
      else 'invoiced'::public.expense_status
    end;
  end if;
end
$$;

create index if not exists expense_entries_status_idx
  on public.expense_entries (status);
