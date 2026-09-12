import { createHash, randomUUID } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, lstatSync, readlinkSync, mkdirSync, writeFileSync, renameSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';

export function command(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed:\n${result.stderr ?? ''}`);
  return (result.stdout ?? '').trim();
}
export const git = (...args) => command('git', args);
export const hash = value => createHash('sha256').update(value).digest('hex');
export const phases = ['tests', 'eslint', 'next-build', 'typescript', 'diff'];
export function atomicJson(path, value) {
  mkdirSync(resolve(path, '..'), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temp, path);
}
export function telemetry(phase, started, cacheHit = false, status = 'passed') {
  const event = { phase, durationMs: Math.round(performance.now() - started), cacheHit, status };
  console.log(JSON.stringify({ releaseTelemetry: event }));
  return event;
}
// Hash actual installed bytes, not just package metadata: modified dependencies
// must never inherit a receipt for an otherwise unchanged lockfile.
export function directoryHash(root) {
  const digest = createHash('sha256');
  function visit(path, name) {
    const stat = lstatSync(path);
    digest.update(`${name}\0${stat.mode}\0`);
    if (stat.isSymbolicLink()) {
      if (path === root || !realpathSync(path).startsWith(`${realpathSync(root)}/`)) throw new Error(`External dependency symlink: ${path}`);
      digest.update(readlinkSync(path));
    }
    else if (stat.isDirectory()) for (const child of readdirSync(path).sort()) visit(join(path, child), `${name}/${child}`);
    else if (stat.isFile()) digest.update(readFileSync(path));
    else throw new Error(`Unsupported validation input: ${path}`);
  }
  visit(root, '');
  return digest.digest('hex');
}
/** @param {Record<string, string | undefined>} [env] */
export function environmentHash(env = process.env) {
  // npm changes these between validate:release and release:production. They are
  // transport metadata, not application inputs. Every other variable is hashed.
  const ignored = /^(npm_lifecycle_event|npm_lifecycle_script|_|SHLVL|PWD|OLDPWD|INIT_CWD)$/;
  return hash(JSON.stringify(Object.entries(env).filter(([key]) => !ignored.test(key)).sort(([a], [b]) => a.localeCompare(b))));
}
export function validationInputs() {
  const files = git('ls-files', '-z').split('\0').filter(Boolean).sort();
  const digest = createHash('sha256');
  for (const file of files) {
    digest.update(`${file}\0`);
    digest.update(existsSync(file) ? readFileSync(file) : '<missing>');
  }
  const envFiles = readdirSync('.').filter(name => name.startsWith('.env') && lstatSync(name).isFile()).sort();
  return {
    version: 1, commit: git('rev-parse', 'HEAD'), main: git('rev-parse', 'origin/main'),
    source: digest.digest('hex'), lockfile: hash(readFileSync('package-lock.json')),
    node: process.version, executable: hash(readFileSync(process.execPath)), platform: process.platform, arch: process.arch,
    environment: environmentHash(), envFiles: hash(JSON.stringify(envFiles.map(name => [name, hash(readFileSync(name))]))),
    dependencies: directoryHash('node_modules'), worktree: resolve('.'),
  };
}
export function receiptMatches(receipt, inputs) {
  return receipt?.version === 1 && receipt.key === hash(JSON.stringify(inputs)) &&
    JSON.stringify(receipt.inputs) === JSON.stringify(inputs) && receipt.status === 'passed' &&
    Array.isArray(receipt.phases) && phases.every(phase => receipt.phases?.some(event => event?.phase === phase && event.status === 'passed'));
}
export function receiptPath(inputs) {
  return resolve('.release/validation', `${hash(JSON.stringify(inputs))}.json`);
}

export function assertReleaseSnapshot({ initialMain, finalMain, head, currentHead, clean, ancestor }) {
  if (!clean) throw new Error('Worktree changed before publication');
  if (currentHead !== head) throw new Error('HEAD changed before publication');
  if (finalMain !== initialMain) throw new Error('origin/main advanced before publication');
  if (!ancestor) throw new Error('origin/main is not an ancestor of the exact release commit');
}

/**
 * Keep the event loop responsive to release interruption while validation runs.
 * @param {string} cmd
 * @param {string[]} args
 * @param {import('node:child_process').SpawnOptions} [options]
 * @returns {Promise<void>}
 */
export function runAsync(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} failed (exit ${code}, signal ${signal})`));
    });
  });
}
