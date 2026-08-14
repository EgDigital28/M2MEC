-- Mark past expense line items as paid (keeps void entries unchanged).

update public.expense_entries
set status = 'paid'::public.expense_status
where expense_date < current_date
  and status <> 'void'::public.expense_status;
