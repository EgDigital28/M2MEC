# Supabase setup

Run the migration in the Supabase SQL editor (or via CLI):

`supabase/migrations/001_waitlist_and_profiles.sql`

## After migration

1. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` and Vercel (Project Settings → API → `service_role` secret).
2. Confirm `RESEND_API_KEY` and optional `RESEND_FROM_EMAIL` are set in Vercel.
3. In Supabase: **Authentication → Providers → Email** → disable **Enable sign ups**. Create users under **Authentication → Users** (invite or add with password). There is no public `/signup` route.

## Tiers (`profiles.tier`)

| Tier | Purpose |
|------|---------|
| `employee` | Internal team — first gated section to build |
| `a` | Full product access (future) |
| `b` | Limited access (default for new auth users) |
| `admin` | Full access + admin capabilities |

## Invites (`/team/invite`)

Employee-tier users (and admins) can invite others from **/team/invite** after logging in.

Flow for the recipient:

1. Invite email from Supabase (Authentication → Emails → **Invite user** template)
2. Click link → `/auth/callback` → `/set-password`
3. Set password → signed in and redirected home

### Supabase auth settings

Under **Authentication → URL configuration**:

- **Site URL:** `https://www.m2mec.com`
- **Redirect URLs:** add `https://www.m2mec.com/auth/callback` and `https://www.m2mec.com/set-password`

Set `NEXT_PUBLIC_SITE_URL` in Vercel so invite links use production, not preview URLs.

### Your first admin account

The **tier** column is on the **`profiles`** table (Table Editor → `profiles`), not on `auth.users`.

**If you don't see a `profiles` table at all:** run the full migration first:

1. Supabase → **SQL Editor** → New query
2. Paste the contents of `supabase/migrations/001_waitlist_and_profiles.sql` → Run

**If `profiles` exists but your row is missing** (you created your auth user before the migration):

1. Run `supabase/migrations/002_backfill_profiles.sql` in the SQL Editor
2. Then set your tier:

```sql
update public.profiles
set tier = 'admin'
where email = 'YOUR_EMAIL_HERE';
```

**If your row exists but tier is `b`:** run only the `update` statement above.

Then log in and open **/team/invite**.


## Waitlist

Early access form submissions go to `waitlist_submissions`. They do **not** create auth users. A welcome email is sent via Resend on submit.
