# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                  # Next dev server on :3000
npm run build                # Production build (typecheck is enabled; next.config.ts has no ignore flags)
npm run lint                 # ESLint (next/core-web-vitals + next/typescript)
node node_modules/typescript/bin/tsc --noEmit   # Explicit typecheck, as the release pipeline runs it

npm run test:creator         # Creator/Ledger integration tests (node:test)
npm run test:release         # Release-guard tests (node:test)
node --test src/lib/creator/consumer.test.ts                 # one test file
node --test --test-name-pattern "signature" src/lib/creator/*.test.ts   # one case
```

Tests are plain `node:test` run directly on TypeScript — no Jest/Vitest, no transpile step. `tsconfig.json` sets `allowImportingTsExtensions`, so **intra-`src` imports inside test-reachable modules use explicit `.ts` extensions** (`import { ... } from "./protocol.ts"`); app code uses the `@/*` alias.

`src/lib/creator/*.test.ts` and the receiver tests execute the **actual migration SQL** in PGlite (`@electric-sql/pglite`) against a minimal fixture schema. When you change a migration that those tests read by filename, update the test fixture too.

## Release — do not improvise

There is no CI. Production publication is a hand-rolled two-phase pipeline in `scripts/`, documented in `docs/guarded-production-release.md`.

1. `npm run validate:release` — requires a clean, committed worktree **on a branch matching `codex/*` or `claude/*`**. Runs tests, lint, build, tsc, `git diff --check` and writes a receipt to `.release/validation/latest.json` bound to the exact commit plus dependency/env/platform hashes.
2. `npm run release:production -- --execute --expected-sha <full SHA>` — **consumes** that receipt. It never re-certifies, installs, rebases or builds. It serializes publishers via CAS on `refs/codex/production-release-queue`, does one ordinary non-force push to `main`, then verifies the Git-triggered Vercel deployment by API and checks both `www.m2mec.com` and `m2mec.com` resolve to it.

A plain push to `main` or `vercel --prod` is not an acceptable substitute. An interrupted publish may record an `uncertain` outcome — inspect remote `main` before retrying rather than assuming nothing shipped.

Each session works on its own `codex/*` or `claude/*` branch and may merge to `main` and publish through this pipeline; the CAS queue on `refs/codex/production-release-queue` serializes concurrent publishers. `docs/guarded-production-release.md` still describes a coordinator-only policy — that applied to the original Codex workstream. The repository owner now owns release windows directly. Production SQL and secret provisioning remain manual and are still not part of this pipeline.

## Architecture

Next.js 15 App Router + React 19 + Tailwind 4, Supabase (Postgres/Auth/RLS) and Resend, on Vercel.

`README.md` describes only the public marketing site and is stale — that is now a small part of the app.

### Access model

Everything hinges on `profiles.tier`, ranked in `src/lib/tiers.ts`: `b` < `a` < `investor` < `employee` < `admin`. There is no public signup; users arrive via invite.

- Public: marketing sections + waitlist (`waitlist_submissions`, Resend welcome email).
- `/team/*` — employee and up, via `requireTeamProfile` (`src/lib/auth/team.ts`). Several pages are admin-only, filtered in `src/lib/team-nav.ts`.
- `/investor` — tier must equal `investor` exactly, via `requireInvestorProfile`; it is not a minimum-tier check.
- API routes use `requireMinimumTier` from `src/lib/auth/profile.ts` and return 401 for `unauthenticated` / 403 for `forbidden`; pages `redirect()` instead.

Suspension (`profiles.suspended_at`) is enforced alongside tier in every guard. `getCurrentProfile` falls back to a narrower column list when `suspended_at` is missing, so the app survives a partially applied migration.

Three Supabase clients, do not mix them: `src/lib/supabase/client.ts` (browser), `server.ts` (RSC/route handler, user session, RLS applies), `admin.ts` (service role, server-only — `tryCreateAdminClient()` returns null instead of throwing when unconfigured so routes can fail closed with 503).

`middleware.ts` refreshes the Supabase session on every non-asset request and rewrites inbound auth links (`code` / `token_hash`) to `/auth/callback`, routing recovery to `/set-password?reason=recovery`.

### The Prediction Ledger (TPL) integration — the most intricate area

M2MEC is a *destination* for picks, packages and private bets published from thepredictionledger.com. Background in `docs/creator-feed-release-20260912.md`.

- **Protocol** (`src/lib/creator/protocol.ts`): `ledger-creator-partner@1`. HMAC-SHA256 over `` `${timestamp}.${body}` ``, 300 s clock window, timing-safe compare, 256 KB cap. `parsePartnerEvent` is deliberately exhaustive and **rejects unknown keys rather than stripping them** — signed bytes and the durable receipt digest must agree, so widening the accepted shape means widening the allowlists in lockstep with the sender.
- **Two ingress paths, one sink**:
  - Push — `POST /api/integrations/ledger-creator`, verified by `LEDGER_CREATOR_SIGNING_SECRET`. `receiver.ts` streams the body to enforce the size cap because `Content-Length` is not authoritative.
  - Pull — `GET /api/integrations/ledger-consumer`, a **Vercel cron every minute** (`vercel.json`), authorized by `CRON_SECRET` with a length-checked timing-safe compare, then serialized by a DB lease (`claim_ledger_consumer` / `release_ledger_consumer`). It acknowledges only events it persisted; failed acknowledgement is safe because replay is idempotent.
  - Both call the same `accept_creator_partner_event` RPC. Idempotent by `eventId`, monotonic by `entityVersion` — a stale version is a no-op, a conflicting identity is a 409.
- **Projection into the local ledger** (`supabase/migrations/20260919133744_ledger_bet_projection.sql`): a trigger on `creator_partner_entities` projects `bet` entities into `bet_entries` with `ledger_entity_id` set. A `guard_ledger_bet` trigger makes those rows **read-only to everything but `service_role`/`postgres`** — grades and corrections only ever flow inbound from TPL, never from the M2MEC UI or a direct admin write. Projection failures are recorded in `ledger_bet_projection_errors` instead of blocking ingest. Sports resolve through `ledger_sport_mappings`; an unmapped sport/league is a recorded error, and mixed-sport parlays map to `multi_sport`/`parlay`.
- **Viewing**: `/team/prediction-ledger` requires admin tier **and** an explicit row in `creator_feed_viewers` (`src/lib/creator/access.ts`), which fails closed on any lookup error. The allowlist currently holds one approved profile.

Note `20260919183700_normalize_ledger_ufc_card_mapping.sql`: it patches `project_ledger_bet` by rewriting `pg_get_functiondef` output and **raises if the predecessor text has drifted**. Editing that function in place will break the migration's anchors — add a new migration instead.

### Domain areas

- **Bets** — `bet_entries` joined to `sports`; derived P/L in `src/lib/bets/calculations.ts` (never persisted). Ledger-projected rows coexist with manually entered ones and are distinguished by `ledger_entity_id`.
- **Email** — Resend, templates in `src/lib/email/`. Sends (today's plays, yesterday's results, weekly summary) are logged to `bet_email_sends` for history and duplicate warnings.
- **Financials/Expenses** — admin-only: cost centers, components, entries with auto-derived quarter; equity and wagering stakes feeding investor cost-coverage and P/L views.

### Migrations

`supabase/migrations/`, mixed naming: early files are `001_`–`018_`, later ones are timestamped. `supabase/README.md` documents the intended apply order and the operator steps (first admin, auth URL config). There is no migration runner in this repo — SQL is applied by the coordinator. The two non-migration `supabase/*.sql` files are narrowly scoped operator provisioning, not repair.

## Conventions

- `src/lib/creator/*` and the integration routes are written in a deliberately dense, low-line-count style with inline validation. Match the surrounding file rather than reformatting it.
- Authorization lookups fail closed: an error from the database means "no access", not "allow".
- Missing server configuration returns 503 rather than throwing or degrading to an unauthenticated path.
- Server env: `SUPABASE_SERVICE_ROLE_KEY`, `LEDGER_CREATOR_SIGNING_SECRET` (≥32 chars, shared with TPL), `LEDGER_CONSUMER_KEY` (`lc_` + 64 hex), `CRON_SECRET`, `RESEND_API_KEY`. Client env is `NEXT_PUBLIC_*` only; see `.env.example`.
