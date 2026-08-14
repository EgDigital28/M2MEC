-- Allow admins to list all profiles using their own session (no service role needed).

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and tier = 'admin'
  );
$$;

create policy "Admins can read all profiles"
  on public.profiles
  for select
  using (public.is_admin());

-- Allow admins to update profiles (suspend / unsuspend) via session client.
create policy "Admins can update all profiles"
  on public.profiles
  for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage suspended emails"
  on public.suspended_emails
  for all
  using (public.is_admin())
  with check (public.is_admin());
