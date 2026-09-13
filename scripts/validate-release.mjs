import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { atomicJson, git, hash, phases, receiptMatches, receiptPath, validationInputs, runAsync } from './release-support.mjs';

// Coordinator grants the heavy validation slot before invoking this command.
// Publication consumes this exact receipt; it never silently reruns certification.
process.env.FORCE_COLOR = '0'; process.env.NO_COLOR = '1';
let owned = false;
let path;
const results = [];
try {
  if (!git('branch', '--show-current').startsWith('codex/') || git('status', '--porcelain')) throw new Error('Certification requires a clean committed feature worktree');
  mkdirSync('.release', { recursive: true });
  mkdirSync('.release/validation.lock'); owned = true;
  writeFileSync('.release/validation.lock/owner.json', JSON.stringify({ pid: process.pid, worktree: resolve('.'), startedAt: new Date().toISOString() }));
  // No dependency installation or mutable dev output can silently enter a receipt.
  rmSync('.next', { recursive: true, force: true });
  const initial = validationInputs();
  path = receiptPath(initial); rmSync(path, { force: true });
  const commands = [
    ['tests', 'npm', ['run', 'test:creator']],
    ['tests', 'npm', ['run', 'test:release']],
    ['eslint', 'npm', ['run', 'lint']],
    ['next-build', 'npm', ['run', 'build']],
    ['typescript', 'node', ['node_modules/typescript/bin/tsc', '--noEmit']],
    ['diff', 'git', ['diff', '--check']],
  ];
  for (const [phase, cmd, args] of commands) {
    const started = Date.now();
    console.log(`> ${cmd} ${args.join(' ')}`);
    await runAsync(cmd, args, { cwd: process.cwd(), env: process.env });
    results.push({ phase, status: 'passed', durationMs: Date.now() - started });
  }
  if (git('status', '--porcelain') || JSON.stringify(validationInputs()) !== JSON.stringify(initial)) throw new Error('Certification input changed during checks');
  const receipt = { version: 1, key: hash(JSON.stringify(initial)), inputs: initial, status: 'passed', createdAt: new Date().toISOString(), phases: results };
  if (!receiptMatches(receipt, initial) || !phases.every(phase => results.some(result => result.phase === phase))) throw new Error('Incomplete certification');
  atomicJson(path, receipt); atomicJson('.release/validation/latest.json', receipt);
  // Verify the exact serialized receipt before reporting success.
  if (!receiptMatches(JSON.parse(readFileSync(path, 'utf8')), initial)) throw new Error('Receipt persistence mismatch');
  console.log(`Exact-commit certification passed: ${initial.commit}`);
} catch (error) {
  if (owned) {
    if (path) rmSync(path, { force: true });
    atomicJson('.release/validation/latest.json', { status: 'failed', phases: results });
  }
  console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1;
} finally { if (owned) rmSync('.release/validation.lock', { recursive: true }); }
