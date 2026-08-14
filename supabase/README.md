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

When you create a user in Supabase (**Authentication → Users → Add user**), a profile row is created automatically with tier `b`. Update tier in **Table Editor → profiles** (e.g. set inner circle to `employee`).

## Waitlist

Early access form submissions go to `waitlist_submissions`. They do **not** create auth users. A welcome email is sent via Resend on submit.
