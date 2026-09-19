-- Preserve explicit mappings; normalize UFC card titles only as a fallback.
-- No source receipts, grades, permissions, or existing ledger rows are rewritten.
begin;
set local lock_timeout='5s';
-- The Bet feed deliberately carries a generic headline ("Single Bet"). Build
-- its compact wager headline from canonical terms, without diagnostic suffixes.
create function public.ledger_bet_headline(leg jsonb) returns text
language sql immutable security invoker set search_path='' as $$
 select btrim(regexp_replace(concat_ws(' ',
  case when lower(leg->>'selection') in ('over','under','yes','no') then leg->>'eventName' end,
  leg->>'selection',
  case when lower(leg->>'direction') is distinct from lower(leg->>'selection') then nullif(leg->>'direction','') end,
  case when leg->>'line' is not null then
   case when (leg->>'line')::numeric>0 and leg->>'marketType' in ('spread','handicap','run_line','game_spread','set_spread','puck_line') then '+' else '' end || (leg->>'line') end,
  nullif(replace(leg->>'marketStatType','_',' '),''),
  nullif(replace(leg->>'marketOutcome','_',' '),''),
  case when leg->>'marketType' in ('moneyline','money_line') then 'ML' end,
  case when leg->>'mmaFinishMethod' is not null then 'by ' || case leg->>'mmaFinishMethod' when 'ko_tko' then 'KO/TKO' else replace(leg->>'mmaFinishMethod','_',' ') end end,
  case when leg->>'mmaRound' is not null then 'round ' || (leg->>'mmaRound') end,
  case when jsonb_array_length(coalesce(nullif(leg->'mmaRounds','null'::jsonb),'[]'::jsonb))>0 then 'rounds ' || (select string_agg(value,', ') from jsonb_array_elements_text(leg->'mmaRounds')) end,
  case when leg->>'mmaDistanceDirection' is not null then replace(leg->>'mmaDistanceDirection','_',' ') || ' distance' end,
  case when leg->>'mmaTotalRounds' is not null then concat_ws(' ',leg->>'mmaTotalDirection',leg->>'mmaTotalRounds','rounds') end
 ),'[[:space:]]+',' ','g'));
$$;
revoke all on function public.ledger_bet_headline(jsonb) from public,anon,authenticated;
grant execute on function public.ledger_bet_headline(jsonb) to service_role;
do $repair$
declare
 definition text:=pg_get_functiondef('public.project_ledger_bet(uuid)'::regprocedure);
 mapping_anchor text:=$old$where m.sport=lower(leg->>'sport') and m.league=lower(coalesce(leg->>'league',''));$old$;
 label_anchor text:=$old$concat(leg->>'eventName',' · ',leg->>'selection',' ',leg->>'marketType',' ',leg->>'line',' · ',leg->>'period')$old$;
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
 definition:=replace(definition,label_anchor,'public.ledger_bet_headline(leg)');
 execute definition;
end $repair$;
commit;
