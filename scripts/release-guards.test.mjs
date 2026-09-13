import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { command, hash, phases, receiptMatches, assertReleaseSnapshot } from './release-support.mjs';
import { remoteQueue, acquireRelease } from './release-queue.mjs';
import { requireDeploymentIdentity, matchesPublicationReceipt } from './release-verification.mjs';

test('certification rejects input drift, failed phases, and main/worktree changes', () => {
  const inputs = { commit: 'a'.repeat(40), main: 'b'.repeat(40), lockfile: 'lock', environment: 'env', dependencies: 'deps', executable: 'node' };
  const receipt = { version: 1, inputs, key: hash(JSON.stringify(inputs)), status: 'passed', phases: phases.map(phase => ({ phase, status: 'passed' })) };
  assert.equal(receiptMatches(receipt, inputs), true);
  assert.equal(matchesPublicationReceipt(receipt, { ...inputs, main: inputs.commit }, true), true);
  assert.equal(matchesPublicationReceipt(receipt, { ...inputs, main: inputs.commit }, false), false);
  assert.equal(matchesPublicationReceipt(receipt, { ...inputs, main: inputs.commit, environment: 'changed' }, true), false);
  assert.equal(matchesPublicationReceipt(receipt, { ...inputs, main: 'unrelated' }, true), false);
  for (const key of Object.keys(inputs)) assert.equal(receiptMatches(receipt, { ...inputs, [key]: 'changed' }), false);
  assert.equal(receiptMatches({ ...receipt, phases: receipt.phases.slice(1) }, inputs), false);
  assert.equal(receiptMatches({ ...receipt, status: 'failed' }, inputs), false);
  const snapshot = { initialMain: 'main', finalMain: 'main', head: 'head', currentHead: 'head', clean: true, ancestor: true };
  assert.doesNotThrow(() => assertReleaseSnapshot(snapshot));
  for (const changed of [{ finalMain: 'advanced' }, { currentHead: 'changed' }, { clean: false }, { ancestor: false }]) assert.throws(() => assertReleaseSnapshot({ ...snapshot, ...changed }));
});

test('deployment and aliases must identify the exact Production Git commit and project', () => {
  const good = { id: 'deployment', readyState: 'READY', target: 'production', projectId: 'project', meta: { githubCommitSha: 'commit', githubCommitRef: 'main' } };
  assert.equal(requireDeploymentIdentity(good, 'commit', 'project'), true);
  for (const bad of [{ ...good, readyState: 'BUILDING' }, { ...good, target: 'preview' }, { ...good, projectId: 'other' }, { ...good, meta: { ...good.meta, githubCommitSha: 'other' } }, { ...good, meta: { ...good.meta, githubCommitRef: 'codex/test' } }]) assert.throws(() => requireDeploymentIdentity(bad, 'commit', 'project'));
});

test('audited remote FIFO serializes two publishers and rejects stale ownership', async () => {
  const root = mkdtempSync(join(tmpdir(), 'm2-release-queue-test-'));
  try {
    const bare = join(root, 'remote.git'), checkout = join(root, 'checkout');
    command('git', ['init', '--bare', bare]); command('git', ['clone', bare, checkout]);
    const git = (...args) => command('git', args, { cwd: checkout });
    git('config', 'user.name', 'Release test'); git('config', 'user.email', 'release-test@example.invalid');
    git('commit', '--allow-empty', '-m', 'fixture');
    const queue = remoteQueue({ cwd: checkout });
    const first = await acquireRelease(queue, { pollMs: 1 });
    const secondPending = acquireRelease(queue, { pollMs: 1 });
    assert.equal(queue.read().state.tickets.length, 2); first.assertOwned();
    await first.release();
    const second = await secondPending; second.assertOwned();
    assert.throws(() => first.assertOwned(), /ownership lost/);
    await second.release(); assert.equal(queue.read().state.tickets.length, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
