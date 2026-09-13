-- Exact viewer provisioning; Deployment Coordinator only after receiver deployment.
-- Lock: one new allowlist key. Rollback: delete only this viewer allowlist key.
-- Feed rows/receipts and the existing sportsbook financial Ledger remain unchanged.
begin;
set local lock_timeout='5s';
do $$
declare target constant uuid:='b9603e59-df71-4edf-b57f-69fa27c8d706';
begin
  if not exists(select 1 from public.profiles where id=target and tier='admin' and suspended_at is null) then raise exception 'Expected active admin viewer is missing'; end if;
  if exists(select 1 from public.creator_feed_viewers where user_id<>target) then raise exception 'Unexpected Creator feed viewer; review access before enabling'; end if;
  insert into public.creator_feed_viewers(user_id) values(target) on conflict do nothing;
end $$;
commit;
