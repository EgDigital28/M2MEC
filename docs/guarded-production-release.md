# M2MEC guarded Production publication

Prepared at the Deployment Coordinator's explicit request. Do not execute before
independent review and the coordinator's assigned validation/publication slot.
Application source already reviewed: `0e78c00ba7536275b4a4c6bf02b184da80a5dbbc`.
This separate release tooling commit adds no application or SQL changes.

## Commands and ownership

1. Integrate current `origin/main` in the dedicated `codex/` worktree; resolve conflicts,
   run focused checks, commit, and push the exact branch. Install local dependencies
   with `npm ci` when needed. Do not borrow another worktree's node_modules.
2. Coordinator grants the heavy slot. Run `npm run validate:release` from the exact
   clean commit and record the actual process exit and `.release/validation/latest.json`.
3. Only the coordinator (or its explicit assignee) invokes
   `npm run release:production -- --execute --expected-sha <full exact SHA>` in the same
   runtime/environment. No automatic migration, secret provisioning or user publication.

Canonical certification executes the Creator receiver tests, release guard tests,
full ESLint, Next Production build, explicit TypeScript check, and diff check.
It clears generated `.next` output before the run; tracked TypeScript configuration
and source, actual installed dependencies, lockfile, Node executable/version,
platform, environment hashes and local env-file hashes bind the receipt. Generated
ignored Next declaration/output files are rebuilt, not reused as receipt inputs.
A local exclusive validation directory prevents overlapping same-worktree runs.
No stale lock is stolen automatically; after an interrupted process is confirmed gone,
the coordinator may remove only its exact `.release/validation.lock` directory.

Publication **consumes** an existing exact receipt. A miss stops and requires another
assigned certification slot; publication never silently builds, integrates, rebases,
installs dependencies, or repeats successful certification. Each command normalizes
color variables; npm lifecycle/PWD transport variables use the same reviewed exclusions
as TPL. No secret values are printed or stored in receipts.

## Guard lineage and deliberate differences from TPL

`release-queue.mjs` is byte-identical to TPL at `a99bec7a392666e332fbc199818a3b6e622a604a`.
It serializes participating publishers through CAS on
`refs/codex/production-release-queue` in the M2MEC remote. Queue CAS uses force-with-lease
only for that queue ref; Production main receives one ordinary non-force exact-SHA push.
No clock-based lease expiry or automatic stealing. The coordinator is the sole approved
Production publisher; other task publishers must use this guard. Before first use,
confirm no independently running legacy publisher/deploy hook is active.

`release-support.mjs` adapts the same TPL source: different phase names and no TPL-only
schema inventory/generated Next-type inputs. Hashing, receipt matching, atomic writes,
final main/HEAD/cleanliness assertions are retained. Async subprocess cancellation
waits for child close before releasing ownership, including abort errors.
The M2MEC publisher does not use TPL cloud certification, schema-health endpoint or
inside-lock integration. Those capabilities do not exist here; SQL compatibility and
application acceptance are explicit coordinator pre/postflight in the Creator handoff.

Before queueing and again under ownership, the guard requires exact pushed feature
HEAD, current-main ancestry and a matching receipt. It verifies GitHub repository and
Vercel project linkage. Before the one main push it rechecks remote main, branch/HEAD,
cleanliness, receipt inputs and FIFO ownership. An unexpected remote update or rejected
push stops. Afterward it requires remote main still equal that SHA, finds the
Git-triggered main deployment by `githubCommitSha`, and uses Vercel's read-only
`/v13/deployments` API to verify exact commit/project/production target/READY state.
Both `www.m2mec.com` and `m2mec.com` must identify that same deployment. Main must still
match at completion. CLI `inspect --json` omits commit/project fields in verified
Vercel 59.16.0, so the guard intentionally uses the full deployment API for identity.
Vercel CLI is pinned to 59.16.0; no Vercel linking, env pulls or `--prod` deploys occur.

## Failure, recovery and evidence

`.release/manifests/<SHA>.json` binds the receipt, queue ticket, initial main, exact
commit, deployment ID, aliases and verification time. `latest-attempt.json` records a
stopped attempt and whether the guarded main push returned successfully. A network
failure during Git push is an uncertain outcome: inspect remote main before retrying.
If main already equals exact HEAD, the guard skips publication and verifies that
existing deployment; it does not issue a duplicate push. For this recovery only, an
original receipt may retain its recorded pre-push main when current main equals the
exact certified HEAD and that recorded base is still its ancestor. Every other input
must match; this exception cannot certify a newer/unrelated main or changed source.

SIGINT/SIGTERM request cancellation. Vercel subprocesses are asynchronous and
abortable; after final synchronous hashing/Git checks an event-loop checkpoint
processes pending signals before the asynchronous abortable main push starts.
A stopped manifest distinguishes `not_started`, `uncertain` (push began but did not
return successfully), `confirmed`, and `already_at_head`. Interruption after push
begins must never be described as proof that nothing was published. Every polling cycle checks cancellation and lock
ownership; the finally block removes only its own queue ticket. A crash or SIGKILL
may strand a ticket. The coordinator must verify that exact owner process is gone and
no push/deployment step is still running before an explicitly reviewed CAS removal of
that ticket. Never rewrite or delete the queue ref, steal another ticket, or force main.
Retain failure receipts. A deployed-but-not-accepted application is not rolled back
by deleting data: fix forward or prepare a reviewed code recovery from current main.
SQL and signing-credential recovery remain the separate Creator handoff instructions.

Focused validation: three guard tests use a temporary local bare Git remote for real
FIFO/CAS ownership transfer, plus input/receipt drift and deployment-identity rejection.
`/private/tmp/m2mec-release-guard-focused.log` actual exit 0;
`/private/tmp/m2mec-release-guard-eslint.log` focused lint actual exit 0.
Publisher-level regressions preserve the actual publisher source while replacing
external IO with hermetic fixtures. SIGTERM during project metadata verification
and final input hashing cannot start a push; SIGTERM after push begins records
an uncertain outcome. `/private/tmp/m2mec-release-cancellation-focused.log`: six
guard/orchestration cases, actual exit 0. No full certification, main push,
deployment, SQL or configuration mutation has been performed while preparing this path. The coordinator must separately approve it.
