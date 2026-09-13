-- Set non-paid expense line items to forecasted (keeps paid and void unchanged).

update public.expense_entries
set status = 'forecasted'::public.expense_status
where status <> 'paid'::public.expense_status
  and status <> 'void'::public.expense_status;
