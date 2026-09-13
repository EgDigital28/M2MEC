-- Track when a user completes invite onboarding (password + name).

alter table public.profiles
  add column if not exists registered_at timestamptz;

-- Existing users who have signed in are treated as fully registered.
update public.profiles p
set registered_at = p.created_at
from auth.users u
where p.id = u.id
  and p.registered_at is null
  and u.last_sign_in_at is not null;

create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
