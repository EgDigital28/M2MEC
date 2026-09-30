import type { BetEntryComputed } from "./calculations.ts";

/** One line of what a person was told about a play in a results email. */
export type ResultReport = {
  bet_entry_id: string;
  results_date: string;
  reported_status: string;
  reported_at: string;
};

/**
 * Plays owed to one person: the latest thing they were told was "Open", and
 * the play has since been graded. A play still open is not repeated day after
 * day; it comes back once, when it has a result.
 *
 * Plays dated `resultsDate` are left out: they are in that email's own table.
 */
export function selectCarryOvers(
  reports: ResultReport[],
  plays: BetEntryComputed[],
  resultsDate: string,
): BetEntryComputed[] {
  const latest = new Map<string, ResultReport>();

  for (const report of reports) {
    const seen = latest.get(report.bet_entry_id);
    const newer =
      !seen ||
      report.results_date > seen.results_date ||
      (report.results_date === seen.results_date && report.reported_at > seen.reported_at);
    if (newer) latest.set(report.bet_entry_id, report);
  }

  return plays
    .filter((play) => play.event_date !== resultsDate)
    .filter((play) => play.status !== "Open")
    .filter((play) => latest.get(play.id)?.reported_status === "Open")
    .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.created_at.localeCompare(b.created_at));
}
