-- Accept the shared Product envelope while preserving Pick, Package and Bet receipts.
-- Product members remain behind Ledger's scoped paginated read API.
-- Lock: brief constraint/function replacement with a five-second lock timeout.
-- Rollback: stop Product feed activation before restoring the prior receiver;
-- retain already accepted Product records and immutable receipts for audit.
begin;
set local lock_timeout='5s';

alter table public.creator_partner_entities drop constraint creator_partner_entities_entity_type_check;
alter table public.creator_partner_entities add constraint creator_partner_entities_entity_type_check
  check(entity_type in ('pick','package','bet','product'));
alter table public.creator_partner_receipts drop constraint creator_partner_receipts_entity_type_check;
alter table public.creator_partner_receipts add constraint creator_partner_receipts_entity_type_check
  check(entity_type in ('pick','package','bet','product'));

do $product_receiver$
declare definition text;old_kind text:='kind not in (''pick'',''package'',''bet'')';
  old_visibility text:='else p_event#>>''{record,visibility}'' is null or p_event#>>''{record,visibility}'' not in (''public'',''premium'') end';
begin
  definition:=pg_get_functiondef('public.accept_creator_partner_event(jsonb,text)'::regprocedure);
  if (length(definition)-length(replace(definition,old_kind,'')))/length(old_kind)<>1
    or (length(definition)-length(replace(definition,old_visibility,'')))/length(old_visibility)<>1
    then raise exception 'Creator receiver predecessor changed';end if;
  definition:=replace(definition,old_kind,'kind not in (''pick'',''package'',''bet'',''product'')');
  definition:=replace(definition,old_visibility,
    'when kind=''product'' then p_event#>>''{record,visibility}'' is null or p_event#>>''{record,visibility}'' not in (''public'',''unlisted'') '||old_visibility);
  execute definition;
end $product_receiver$;

notify pgrst,'reload schema';
commit;
