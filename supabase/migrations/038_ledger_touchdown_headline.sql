-- Touchdown-scorer bets read "Pat Freiermuth Anytime Touchdown" rather than
-- the feed's raw terms joined together ("Pat Freiermuth anytime yes"). Every
-- other market keeps the headline it had. The Ledger's original legs stay
-- untouched in creator_partner_entities; only the derived event_name changes.
begin;
set local lock_timeout='5s';
create or replace function public.ledger_bet_headline(leg jsonb) returns text
language sql immutable security invoker set search_path='' as $$
 select case when leg->>'marketType'='touchdown_scorer' then
  btrim(regexp_replace(concat_ws(' ',
   leg->>'selection',
   case when lower(leg->>'marketOutcome')='no' then 'No' end,
   initcap(nullif(replace(leg->>'marketStatType','_',' '),'')),
   'Touchdown'
  ),'[[:space:]]+',' ','g'))
 else btrim(regexp_replace(concat_ws(' ',
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
 ),'[[:space:]]+',' ','g')) end;
$$;
revoke all on function public.ledger_bet_headline(jsonb) from public,anon,authenticated;
grant execute on function public.ledger_bet_headline(jsonb) to service_role;
-- Rebuild already-projected bets that hold a touchdown leg, joining legs the
-- way project_ledger_bet does. Grades, amounts and versions are not touched.
update public.bet_entries b set event_name=h.label,updated_at=now()
from (select e.entity_id,string_agg(public.ledger_bet_headline(l.leg),' + ' order by l.n) label
 from public.creator_partner_entities e cross join lateral jsonb_array_elements(e.record->'legs') with ordinality l(leg,n)
 where e.source='thepredictionledger' and e.entity_type='bet'
 group by e.entity_id having bool_or(l.leg->>'marketType'='touchdown_scorer')) h
where b.ledger_entity_id=h.entity_id and b.event_name is distinct from h.label;
commit;
