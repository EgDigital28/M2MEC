-- Run this AFTER 001_waitlist_and_profiles.sql if you already had auth users
-- before the migration (no profile row was auto-created for them).

insert into public.profiles (id, email, tier)
select
  u.id,
  u.email,
  'b'::public.user_tier
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

-- Replace with your login email, then run:
-- update public.profiles set tier = 'admin' where email = 'you@example.com';
