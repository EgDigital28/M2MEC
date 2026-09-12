# Creator, M2MEC and Bet release package — 2026-09-12

## Scope and checkout identity

- TPL branch `codex/creator-m2mec-20260912`, checkout `/private/tmp/thepredictionledger-creator-m2mec-20260912`; integrated main `9bb2690b19d6fd96fc105847bf200d3e8f61e546` before feature commit.
- M2MEC branch `codex/creator-integration-20260912`, checkout `/private/tmp/m2mec-creator-integration-20260912`; main base `d83664a19ea7a6f88c9f2ccf31259efcc2a4f243`.
- Exact clean commits and certification receipts are supplied in the coordinator handoff after commit. A focused check does not certify a release.
- The urgent `straight` → `single` fix is already live as `9bb2690b…`, Production `dpl_6GXpPrzv3kgACKSrR7G2yvzUN9RL`. It is a dependency, not a second pending repair.

## Changes and collisions

TPL adds an explicitly connected M2MEC destination, a transactional versioned outbox,
owner delivery history/retry, package publication/withdrawal, Creator origin badges,
and the existing handicapper profile link. The same recurring Creator delivery job
sends lifecycle updates every minute using its existing admission and lease controls.
Retraction and correction retain receipts and use existing before-start/change locks.

The Bet navigation and private receipt flow reuse reviewed canonical Creator matching
and publication. Manual entry requires both an allowlist and an enabled test switch,
and is rejected once sportsbook connections are available or this account is connected.
Permanent photo uploads keep private evidence, digest, OCR text and review provenance.
Cash, bonus stakes, placed times, ticket/account identity, odds and future settlement/
provider fields remain separate from the canonical Ledger grade and tracking units.
Bet records are excluded from Say/Sell totals and public-profile disclosure. No bet is
placed, sportsbook connection activated, model enabled, or payment collected.

M2MEC adds an HMAC receiver with atomic receipts and monotonic entity projections,
and an explicitly allowlisted active-admin Prediction Ledger tab beside the existing
sportsbook Ledger. Packages link their member plays/current grades. Existing cash
wager reporting, financials, investors and email sends are not changed.

Collision surfaces: TPL Creator layout/dashboard/product selectors, betslip and parse
routes, the delivery cron, provider registry, destination CHECK, Creator and Ledger
additive origin fields, and `creator_workspace_performance`. The latter keeps its
existing implementation/ACL and adds the Bet exclusion. M2MEC TeamShell/layout,
new receiver route, package lock, and TypeScript test-import option are affected.
Review any concurrent edits to these surfaces before integrating; do not drop another
migration's inventory entry or relax publication/grading guards.

## SQL inventory

| Repo | File | SHA-256 | Bytes | Initial status |
| --- | --- | --- | ---: | --- |
| TPL | `supabase/migrations/20260912213838_add_creator_m2mec_outbox.sql` | `cb579aeceea0e8bb12003b31e15d776f00f687bcf04356635bc43b96743699ca` | 26816 | Unapplied |
| TPL | `supabase/migrations/20260912220740_add_creator_bet_receipts.sql` | `cc3ba8b6d74a4843793bbadebc0d26a1a93c909aa804ed7abfeec7d963e9c795` | 21096 | Unapplied |
| TPL | `supabase/creator-m2mec-bet-enable-test-20260912.sql` | `a67af7fc6f439ba87aaad52f4031ff9a8871f2155977893b524e11d1b4224de4` | 1673 | Unapplied |
| M2MEC | `supabase/migrations/20260912213839_add_creator_partner_feed.sql` | `7612af5a48a137f97d65a097b02b39ea4e2bd90feada3c38fc0416d908d6f4f9` | 6954 | Unapplied |
| M2MEC | `supabase/creator-feed-enable-test-viewer-20260912.sql` | `6071fe430c061f7bcd6544d77a8a9076ed3da6598a3683d44af6415455577848` | 823 | Unapplied |

Apply in this order:

1. M2MEC `20260912213839` (depends on existing profiles with tier/suspended_at).
2. M2MEC receiver/UI deployment, server credential and exact viewer provisioning.
3. TPL `20260912213838` (Creator foundation, Content Studio, Ledger grading components).
4. TPL `20260912220740` (previous outbox/private schema; existing Creator ticket/editorial core and urgent repair; private Supabase Storage).
5. TPL sender/UI deployment and matching server credential.
6. TPL exact tester provisioning, after preflight confirms no other allowlisted testers or active sportsbook connection. No automatic destination opt-in; the creator clicks Connect M2MEC.

The two non-migration SQL files are narrowly scoped operator provisioning, not
historical repair. Retain their exact hash, actor, execution time and returned
postflight in the deployment receipt. Repeating them is idempotent; unexpected
access or changed account status stops the transaction. Do not alter migration
history to hide any tool-assigned migration timestamp.

## Configuration and ownership

Only the Deployment Coordinator executes Production SQL, provisions configuration,
or publishes either project unless it explicitly assigns a step.

- TPL project `pwrejtulucueofkzkmys`; existing Vercel `thepredictionledger`.
- M2MEC project `zknvtqlzlxpbvjydoqza`; Vercel `eg-digital1/m2-mec`, project `prj_MNkLOiIWXD9Ai1aAxi0RkcU62OtQ`, GitHub `EgDigital28/M2MEC`, Production branch `main`, repo ID `1333480352`.
- Server-only credential: TPL `CREATOR_M2MEC_SIGNING_SECRET` and M2MEC `LEDGER_CREATOR_SIGNING_SECRET` must hold the same cryptographically random value (at least 32 characters). Never put its value in a command, receipt, browser, SQL or task message. Use the coordinator's secure existing configuration mechanism.
- Fixed sender URL: `https://www.m2mec.com/api/integrations/ledger-creator`.
- TPL tester account: `f9e59c63-63c7-442d-b1a0-ee9f143a29c3`, handle `ennis_itan`, active.
- M2MEC viewer profile: `b9603e59-df71-4edf-b57f-69fa27c8d706`, active admin. Only this profile receives feed access; other admins remain excluded.
- Existing OCR configuration/quota is reused. No new model, provider or quota activation is part of this package.

M2MEC has no existing release pipeline or CI workflows. Its verified empty
`next.config.ts` leaves build typechecking enabled. The coordinator must approve
and assign its exact certification/publication path. Do not substitute a manual
main push or `vercel --prod`. TPL remains `validate:release`/`release:production`.

## Focused validation and limits

Actual new SQL is executed in PGlite for outbox capture, package publication,
retries, leases, grade/regrade/correction/withdrawal snapshots, immutable event
payloads and access boundaries. The receiver tests execute actual SQL and the
actual signed HTTP handler, including rejected signatures, streamed size limits,
idempotent retries, stale versions and conflicting identities. Transport tests
sign actual outbox payloads and require the matching remote receipt.

Bet tests execute the actual new receipt RPC, controls, origin/privacy triggers,
RLS and monetary validations around a contract fixture for the existing publisher.
They prove atomic rollback, private Bet provenance, stable retry, default units
separate from cash, cross-owner rejection and that disabling manual entry leaves
slip-backed recording enabled. They do not execute the entire Production Creator
publisher/trigger graph or call live OCR. A fixture is not a live acceptance receipt.

Existing affected Creator destination, upload quota/timeout, event-correction,
workspace and delivery-route regression checks are included in focused validation.
Exact process exits/logs are supplied with the handoff. Full certification is
slot-gated and must run against the final clean commit.

## Preflight and postflight

Before mutation, verify current main ancestry, clean pushed commit, exact file hashes,
existing migration history, the urgent publisher fingerprint, active target accounts,
and absence of conflicting new relations/bucket. Confirm the M2MEC active-admin RLS
and TPL existing Creator publication/grading policies remain in place. Inventory
all new table/RPC grants and run Supabase advisors for the affected schema changes.

After SQL, verify:

- New tables have RLS. Browser roles cannot write Bet/outbox/inbound records or invoke worker/receiver RPCs. Private-schema functions have no browser/service EXECUTE grants.
- Viewer/tester allowlists contain only the exact approved targets; no other account receives access.
- Storage bucket `creator-bet-evidence` is private with 10 MB/image-type limits and no new direct client Storage policies.
- Manual controls are enabled only for the tester, with connections unavailable; receipt upload has no dependency on the manual test flag.
- Existing canonical pick-type constraint, publication ACLs, immutable receipts, change locks and public-profile disclosure stay unchanged.
- Both exact Git-triggered Production deployments reach READY and their canonical aliases resolve to the certified commits. M2MEC unsigned receiver requests reject without rows; missing credentials fail closed.

The site's being reachable is not proof of a published/delivered pick. Retain separate
SQL, deployment, alias, authorization and application acceptance receipts.

## Live acceptance walkthrough

Using the user's existing sessions and deliberate test submissions:

1. Creator → Destinations → Connect M2MEC. Confirm authorized/active and no automatic selections on the composer.
2. Review a supported future single with explicit price/stake; select M2MEC and publish. Check one immutable Creator receipt, one canonical Ledger `single`, Creator origin, no Candidate Queue row, and a matching successful remote receipt/event ID. Keep intended public-profile controls explicit.
3. Open M2MEC → Prediction Ledger → Plays as the allowed admin. Confirm headline/analysis, event, wager, odds, units, original timestamp, grade and profile link. Signed-out and non-allowlisted roles must see no feed data.
4. Publish a two-leg parlay and one package from the same product. Check one ticket stake, ordered legs, package price/window/membership, and linked member grades. Retry transport safely without duplicate entities/packages.
5. Before start, correct or retract a deliberate test play with a reason. Check retained original, linked replacement/tombstone, voided old Ledger projection and withdrawn affected package. Confirm changes lock once any event starts or a grade exists.
6. Observe normal grading/regrading update the same remote entity/version. Do not fabricate a Production grade on a real play. Any synthetic grade fixture needs an exact separately reviewed coordinator scope.
7. Creator → View my profile opens the same existing handicapper profile. Upcoming/results-off plays remain hidden; eligible public plays use the existing disclosure timing.
8. Creator → Bet → manual tester entry: record one single/parlay with sportsbook, private account, real ticket price, cash/bonus/currency and placed time. Verify private Bet origin, cash distinct from units, stable retry, no M2MEC/public-profile/Say-Sell-performance entry.
9. Bet → Upload betslip photo: review OCR/match and receipt fields, record, reopen private image, verify digest/provenance. Reuploading the same image returns the existing review/receipt; a reused sportsbook ticket ID is rejected.
10. In the scoped test environment, disable manual testing or mark connections available: typed Bet input disappears and direct manual recording rejects, while photo upload/review still works. Preserve all prior test receipts.

Do not publish as another user, create fake public performance, or mark a real
wager graded solely to manufacture acceptance. If a live user submission or normal
grade has not occurred, identify that exact remaining acceptance step.

## Recovery and remaining scope

Pause only the affected M2MEC destination to stop outbound delivery; missing server
configuration also stops the sender. Disable the manual-testing control immediately
if needed. Remove only the exact M2MEC viewer allowlist key to revoke feed access.
Retain outbox events, inbound receipts, Creator/Bet receipts and private evidence.
After fixing a transport/configuration issue, owner Retry reuses the immutable event
ID; remote deduplication prevents another entity. Stale leases recover under bounded
backoff. Never hard-delete published records or broadly replay historical picks.

Supported now: existing upcoming/live Creator single/parlay markets. Past receipts,
unsupported/system wagers, live sportsbook synchronization/verification/settlement,
payments and broader audience access remain future work. The Bet shell permits
retraction under existing timing guards; editing a recorded Bet or replacing its
sportsbook settlement is not enabled. Manual test input ends when connections ship;
photo upload remains permanent.

Historical repair: NONE. No backfill, loss deletion, candidate repair, model activation
or broad replay is included. A test record's audit history stays a test history.
