import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { acquireRelease } from './release-queue.mjs';
import { atomicJson, git, receiptPath, validationInputs, assertReleaseSnapshot } from './release-support.mjs';
import { requireDeploymentIdentity, matchesPublicationReceipt } from './release-verification.mjs';

const project = 'm2-mec';
const projectId = 'prj_MNkLOiIWXD9Ai1aAxi0RkcU62OtQ';
const scope = 'eg-digital1';
const aliases = ['https://www.m2mec.com', 'https://m2mec.com'];
process.env.FORCE_COLOR = '0'; process.env.NO_COLOR = '1';
const controller = new AbortController();
const stop = () => controller.abort();
process.on('SIGINT', stop); process.on('SIGTERM', stop);
let lock;
let head;
let published = false;
const pause = () => new Promise(resolve => setTimeout(resolve, 5000));
function checkInterrupted() { if (controller.signal.aborted) throw new Error('Release interrupted'); }
function vercel(args) {
  checkInterrupted();
  const result = spawnSync('npx', ['--yes', 'vercel@59.16.0', ...args, '--scope', scope], { encoding: 'utf8', timeout: 60000 });
  if (result.error || result.status !== 0) throw new Error(`Vercel ${args[0]} failed (exit ${result.status})`);
  try { return JSON.parse(result.stdout); } catch { throw new Error('Vercel returned invalid JSON'); }
}
function ancestor(main, commit) {
  return spawnSync('git', ['merge-base', '--is-ancestor', main, commit]).status === 0;
}
function exactReceipt() {
  const inputs = validationInputs();
  let receipt;
  try { receipt = JSON.parse(readFileSync(receiptPath(inputs), 'utf8')); } catch {
    try { receipt = JSON.parse(readFileSync('.release/validation/latest.json', 'utf8')); } catch { throw new Error('Exact certification receipt missing; request a validation slot'); }
  }
  const base = receipt?.inputs?.main;
  const priorBase = typeof base === 'string' && /^[0-9a-f]{40}$/.test(base) && ancestor(base, inputs.commit);
  if (!matchesPublicationReceipt(receipt, inputs, priorBase)) throw new Error('Exact certification receipt does not match current inputs');
  return receipt;
}
try {
  const expected = process.argv[process.argv.indexOf('--expected-sha') + 1];
  if (!process.argv.includes('--execute') || !process.argv.includes('--expected-sha') || !/^[0-9a-f]{40}$/.test(expected ?? '')) throw new Error('Coordinator execution requires --execute --expected-sha <full commit>');
  head = git('rev-parse', 'HEAD');
  const branch = git('branch', '--show-current');
  if (head !== expected || !branch.startsWith('codex/') || git('status', '--porcelain')) throw new Error('Expected clean feature commit mismatch');
  const remote = git('remote', 'get-url', 'origin');
  if (!/^(https:\/\/github\.com\/|git@github\.com:)EgDigital28\/M2MEC(?:\.git)?$/.test(remote)) throw new Error('Unexpected publication repository');
  git('fetch', 'origin', '--prune');
  if (git('rev-parse', `origin/${branch}`) !== head) throw new Error('Exact feature HEAD must be pushed');
  if (!ancestor(git('rev-parse', 'origin/main'), head)) throw new Error('Integrate and certify current main before publication');
  const receipt = exactReceipt();
  // Same audited remote CAS/FIFO algorithm as TPL, scoped to the M2MEC Git remote.
  lock = await acquireRelease(undefined, { signal: controller.signal });
  checkInterrupted(); lock.assertOwned();
  git('fetch', 'origin', '--prune');
  const initialMain = git('rev-parse', 'origin/main');
  exactReceipt();
  const projectInfo = vercel(['api', `/v9/projects/${projectId}`, '--raw']);
  if (projectInfo.id !== projectId || projectInfo.name !== project || projectInfo.link?.type !== 'github' || projectInfo.link?.org !== 'EgDigital28' || projectInfo.link?.repo !== 'M2MEC' || projectInfo.link?.productionBranch !== 'main') throw new Error('Vercel project Git identity mismatch');
  git('fetch', 'origin', '--prune');
  const finalMain = git('rev-parse', 'origin/main');
  exactReceipt();
  lock.assertOwned(); checkInterrupted();
  assertReleaseSnapshot({ initialMain, finalMain, head, currentHead: git('rev-parse', 'HEAD'), clean: !git('status', '--porcelain'), ancestor: ancestor(finalMain, head) });
  if (git('branch', '--show-current') !== branch || git('rev-parse', `origin/${branch}`) !== head) throw new Error('Feature branch changed before publication');
  if (finalMain !== head) {
    // Ordinary non-force push; remote main movement is rejected by Git. No merge/rebase/revalidation inside publication.
    git('push', 'origin', `${head}:refs/heads/main`); published = true;
  }
  git('fetch', 'origin', '--prune');
  if (git('rev-parse', 'origin/main') !== head) throw new Error('Remote main differs after publication');
  const deadline = Date.now() + 10 * 60000;
  let deployment;
  while (Date.now() < deadline) {
    checkInterrupted(); lock.assertOwned();
    const listing = vercel(['list', project, '--meta', `githubCommitSha=${head}`, '--json', '--limit', '20']);
    deployment = (listing.deployments ?? []).filter(item => item.meta?.githubCommitRef === 'main' && item.meta?.githubCommitSha === head).sort((a,b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))[0];
    if (deployment) {
      const inspected = vercel(['api', `/v13/deployments/${encodeURIComponent(deployment.url)}`, '--raw']);
      if (['ERROR', 'CANCELED'].includes(inspected.readyState)) throw new Error(`Deployment entered ${inspected.readyState}`);
      if (inspected.readyState === 'READY') { requireDeploymentIdentity(inspected, head, projectId); deployment = inspected; break; }
    }
    await pause();
  }
  if (deployment?.readyState !== 'READY') throw new Error('Exact Git-triggered deployment did not reach READY');
  for (const alias of aliases) {
    let matched = false;
    while (Date.now() < deadline) {
      checkInterrupted(); lock.assertOwned();
      const deployed = vercel(['api', `/v13/deployments/${encodeURIComponent(new URL(alias).hostname)}`, '--raw']);
      if (deployed.id === deployment.id) { requireDeploymentIdentity(deployed, head, projectId); matched = true; break; }
      await pause();
    }
    if (!matched) throw new Error(`Canonical alias did not converge: ${alias}`);
  }
  git('fetch', 'origin', '--prune');
  if (git('rev-parse', 'origin/main') !== head) throw new Error('Main advanced after deployment');
  atomicJson(`.release/manifests/${head}.json`, { status: 'READY', commit: head, initialMain, published, deploymentId: deployment.id, deploymentUrl: `https://${deployment.url}`, aliases, queueTicket: lock.ticket, validation: receipt, verifiedAt: new Date().toISOString() });
  console.log(`Verified Production deployment ${deployment.id} at exact commit ${head}; application/SQL acceptance is separate.`);
} catch (error) {
  atomicJson('.release/manifests/latest-attempt.json', { status: 'stopped', commit: head ?? null, published, queueTicket: lock?.ticket ?? null });
  console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1;
} finally {
  if (lock) { try { await lock.release(); } catch { console.error('Remote queue cleanup failed; explicit ticket recovery required'); process.exitCode = 1; } }
  process.off('SIGINT', stop); process.off('SIGTERM', stop);
}
