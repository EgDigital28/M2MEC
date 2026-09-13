import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { command } from './release-support.mjs';

/** @typedef {{id: string, host?: string, pid?: number, enqueuedAt?: string}} QueueTicket */
/** @typedef {{version: number, tickets: QueueTicket[]}} QueueState */

export const queueRef = 'refs/codex/production-release-queue';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// A single remote ref is the linearization point for both FIFO admission and
// ownership. No clock ordering, expiring lease, or local-only lock is involved.
export function remoteQueue({ cwd = process.cwd(), remote = 'origin', ref = queueRef } = {}) {
  const git = (...args) => command('git', args, { cwd });
  /** @returns {{oid: string, state: QueueState}} */
  function read() {
    const listing = git('ls-remote', remote, ref);
    if (!listing) return { oid: '', state: { version: 1, tickets: [] } };
    git('fetch', '--quiet', '--no-tags', '--no-write-fetch-head', remote, ref);
    const oid = listing.split(/\s/)[0];
    const state = JSON.parse(git('show', '-s', '--format=%B', oid));
    if (state.version !== 1 || !Array.isArray(state.tickets)) throw new Error('Invalid release queue state');
    return { oid, state };
  }
  function compareAndSwap(previous, state) {
    const tree = git('rev-parse', 'HEAD^{tree}');
    const oid = git('commit-tree', tree, ...(previous.oid ? ['-p', previous.oid] : []), '-m', JSON.stringify(state));
    try {
      git('push', '--quiet', `--force-with-lease=${ref}:${previous.oid}`, remote, `${oid}:${ref}`);
      return true;
    } catch (error) {
      // Only retry a proven CAS conflict. Authentication/network/ref-policy
      // failures must stop rather than masquerade as a busy queue.
      const now = git('ls-remote', remote, ref).split(/\s/)[0];
      if (now !== previous.oid) return false;
      throw error;
    }
  }
  /** @param {(state: QueueState) => QueueState | undefined} mutator */
  async function update(mutator) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const previous = read();
      const state = mutator(structuredClone(previous.state));
      if (!state) return previous.state;
      if (compareAndSwap(previous, state)) return state;
      await sleep(100 + Math.random() * 200);
    }
    throw new Error('Release queue contention exceeded retry limit');
  }
  return { read, update, compareAndSwap };
}

/**
 * @param {ReturnType<typeof remoteQueue>} [queue]
 * @param {{pollMs?: number, signal?: AbortSignal}} [options]
 */
export async function acquireRelease(queue = remoteQueue(), { pollMs = 5000, signal } = {}) {
  const ticket = { id: randomUUID(), host: hostname(), pid: process.pid, enqueuedAt: new Date().toISOString() };
  const release = async () => queue.update(state => {
    state.tickets = state.tickets.filter(item => item.id !== ticket.id);
    return state;
  });
  await queue.update(state => { if (!state.tickets.some(item => item.id === ticket.id)) state.tickets.push(ticket); return state; });
  console.log(`Production queue ticket ${ticket.id}; abandoned tickets require explicit operator recovery.`);
  try {
    while (true) {
      if (signal?.aborted) throw new Error('Release queue wait interrupted');
      const { state } = queue.read();
      if (!state.tickets.some(item => item.id === ticket.id)) throw new Error('Release queue ticket disappeared');
      if (state.tickets[0].id === ticket.id) return {
        ticket,
        assertOwned() {
          if (queue.read().state.tickets[0]?.id !== ticket.id) throw new Error('Production release lock ownership lost');
        },
        release,
      };
      await sleep(pollMs);
    }
  } catch (error) {
    await release();
    throw error;
  }
}
