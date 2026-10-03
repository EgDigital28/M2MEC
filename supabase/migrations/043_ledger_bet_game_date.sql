-- A Ledger play's date is the day its game is played, not the day it was
-- placed. A bet placed Saturday morning on Sunday's game belongs to Sunday:
-- in Sunday's today's plays email, Sunday's results and Sunday's totals.
--
-- Set alongside the games themselves, in the trigger that already fills
-- ledger_events on every projected write, rather than by rewriting
-- project_ledger_bet (see 20260919183700 on why that function is fragile).
-- The date is the latest game's start in Eastern time, so a parlay belongs to
-- the day its last game is played. Without any game time it keeps the day
-- placed. Only well-formed start times are read: a malformed one must not
-- fail the projection and drop the bet.
begin;
set local lock_timeout='5s';
create or replace function public.fill_ledger_bet_events() returns trigger
language plpgsql set search_path='' as $$
declare last_start timestamptz;
begin
 if new.ledger_entity_id is not null and current_user in ('service_role','postgres') then
  new.ledger_events:=public.ledger_bet_events(new.ledger_entity_id);
  select max((ev->>'startsAt')::timestamptz) into last_start
  from jsonb_array_elements(new.ledger_events) ev
  where ev->>'startsAt' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}';
  if last_start is not null then
   new.event_date:=(last_start at time zone 'America/New_York')::date;
  end if;
 end if;
 return new;
end $$;
-- Re-date what is already imported; the trigger recomputes on this write.
update public.bet_entries set ledger_events=ledger_events where ledger_entity_id is not null;
commit;
