import type { BetEntryComputed } from "@/lib/bets/calculations";

/**
 * How one person's today's plays email is laid out.
 *
 * Kept free of runtime imports so it can be tested directly with node:test.
 */
export type TodaysPlaysSplit = {
  /** No today's plays email has reached this person yet today. */
  isFirst: boolean;
  /** Plays that arrived after the last email to this person: open first. */
  newPlays: BetEntryComputed[];
  /** Plays already emailed today: still-open ones first, graded ones last. */
  earlierPlays: BetEntryComputed[];
};

function byArrival(a: BetEntryComputed, b: BetEntryComputed) {
  return Date.parse(a.created_at) - Date.parse(b.created_at);
}

/** Still-open plays first, graded ones at the bottom, each in arrival order. */
function openFirst(entries: BetEntryComputed[]) {
  const sorted = [...entries].sort(byArrival);
  return [
    ...sorted.filter((entry) => entry.status === "Open"),
    ...sorted.filter((entry) => entry.status !== "Open"),
  ];
}

/**
 * "New" is decided by arrival time, not by counting. A count can hide a new
 * play: if one earlier play is graded and one new play arrives, a count of
 * open plays stays the same. Arrival time is stamped when a play first lands
 * and is not changed when the Ledger later updates it, so an edited play is
 * never mistaken for a new one.
 *
 * @param lastSentAt when the last today's plays email to this person was
 *   cut off, or null if none has gone out today.
 */
export function splitTodaysPlays(
  entries: BetEntryComputed[],
  lastSentAt: string | null,
): TodaysPlaysSplit {
  const cutoff = lastSentAt ? Date.parse(lastSentAt) : null;
  const isNew = (entry: BetEntryComputed) =>
    cutoff === null || Date.parse(entry.created_at) > cutoff;

  return {
    isFirst: cutoff === null,
    newPlays: openFirst(entries.filter(isNew)),
    earlierPlays: openFirst(entries.filter((entry) => !isNew(entry))),
  };
}

export type TodaysPlaysTotals = {
  openCount: number;
  openRisk: number;
  openToWin: number;
  wins: number;
  losses: number;
  voids: number;
  /** Net result of graded plays. Voids contribute nothing. */
  settledNet: number;
  settledCount: number;
};

export function todaysPlaysTotals(entries: BetEntryComputed[]): TodaysPlaysTotals {
  const open = entries.filter((entry) => entry.status === "Open");
  const graded = entries.filter((entry) => entry.status === "Win" || entry.status === "Loss");

  return {
    openCount: open.length,
    openRisk: open.reduce((sum, entry) => sum + entry.risk, 0),
    openToWin: open.reduce((sum, entry) => sum + entry.to_win, 0),
    wins: entries.filter((entry) => entry.status === "Win").length,
    losses: entries.filter((entry) => entry.status === "Loss").length,
    voids: entries.filter((entry) => entry.status === "Void").length,
    settledNet: graded.reduce((sum, entry) => sum + entry.profit_loss, 0),
    settledCount: entries.length - open.length,
  };
}
