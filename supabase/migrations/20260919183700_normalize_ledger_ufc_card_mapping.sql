-- Preserve explicit mappings; normalize UFC card titles only as a fallback.
-- No source receipts, grades, permissions, or existing ledger rows are rewritten.
begin;
set local lock_timeout='5s';
do $repair$
declare
 definition text:=pg_get_functiondef('public.project_ledger_bet(uuid)'::regprocedure);
 mapping_anchor text:=$old$where m.sport=lower(leg->>'sport') and m.league=lower(coalesce(leg->>'league',''));$old$;
 label_anchor text:=$old$leg->>'marketType',' ',leg->>'line'$old$;
begin
 if cardinality(string_to_array(definition,mapping_anchor))<>2 or cardinality(string_to_array(definition,label_anchor))<>2 then
  raise exception 'Ledger Bet projection predecessor drift';
 end if;
 definition:=replace(definition,mapping_anchor,$new$where m.sport=lower(btrim(leg->>'sport'))
 and (m.league=lower(btrim(coalesce(leg->>'league','')))
  or (lower(btrim(leg->>'sport'))='mma'
   and lower(btrim(coalesce(leg->>'league',''))) ~ '^ufc([[:space:]]|[0-9]|:|$)'
   and m.league='ufc'))
 order by (m.league=lower(btrim(coalesce(leg->>'league','')))) desc
 limit 1;$new$);
 definition:=replace(definition,label_anchor,$new$case when leg->>'marketType'='fighter_method' then
  'by ' || case leg->>'mmaFinishMethod' when 'ko_tko' then 'KO/TKO' when 'submission' then 'submission' when 'decision' then 'decision' else coalesce(leg->>'mmaFinishMethod','fighter method') end
 else leg->>'marketType' end,' ',leg->>'line'$new$);
 execute definition;
end $repair$;
commit;
