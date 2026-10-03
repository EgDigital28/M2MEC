import type { BetEntryComputed } from "@/lib/bets/calculations";
import { compareWithinDay, eventDays } from "./ledger-events.ts";

/**
 * How one person's today's plays email is laid out.
 *
 * Runs directly under node:test, so its imports use explicit .ts paths.
 */
export type TodaysPlaysSplit = {
  /** No today's plays email has reached this person yet today. */
  isFirst: boolean;
  /** Plays that arrived after the last email to this person: open first, by game time. */
  newPlays: BetEntryComputed[];
  /** Plays already emailed today: open first, graded last, each by game time. */
  earlierPlays: BetEntryComputed[];
};

/**
 * Open plays first by game time, graded plays at the bottom by game time —
 * the same order as the ledger page. A parlay sorts by its latest game.
 */
function openFirst(entries: BetEntryComputed[]) {
  return [...entries].sort(compareWithinDay);
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

/**
 * Plays dated later (a parlay is dated by its last game) that have a game on
 * `day`: a Saturday + Sunday parlay is one of Saturday's plays as well as
 * Sunday's, graded or not, so a parlay that loses on Saturday shows that loss
 * in Saturday's email.
 */
export function spanningPlays(laterPlays: BetEntryComputed[], day: string) {
  return laterPlays.filter((play) => play.event_date > day && eventDays(play.ledger_events).includes(day));
}

/**
 * Tomorrow's look ahead lists only plays still open: a parlay that already
 * lost on an earlier leg is settled and has nothing left to look ahead to.
 */
export function lookaheadPlays(tomorrowsPlays: BetEntryComputed[]) {
  return tomorrowsPlays.filter((play) => play.status === "Open").sort(compareWithinDay);
}
