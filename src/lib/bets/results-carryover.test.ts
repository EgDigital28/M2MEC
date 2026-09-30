import assert from "node:assert/strict";
import { test } from "node:test";
import type { BetEntryComputed } from "./calculations.ts";
import { selectCarryOvers, type ResultReport } from "./results-carryover.ts";

const play = (id: string, event_date: string, status: BetEntryComputed["status"]) =>
  ({ id, event_date, status, created_at: `${event_date}T12:00:00Z` }) as BetEntryComputed;

const report = (id: string, results_date: string, reported_status: string, reported_at = `${results_date}T07:00:00Z`): ResultReport =>
  ({ bet_entry_id: id, results_date, reported_status, reported_at });

test("a play sent as Open and graded since comes back in the next results email", () => {
  // The Sep 29 email went out at 3am with Diop and Bulaid still open; both
  // were graded after. The Sep 30 email owes them.
  const reports = [report("diop", "2026-09-29", "Open"), report("bulaid", "2026-09-29", "Open"), report("bertolso", "2026-09-29", "Win")];
  const plays = [play("diop", "2026-09-29", "Win"), play("bulaid", "2026-09-29", "Void"), play("bertolso", "2026-09-29", "Win")];

  assert.deepEqual(selectCarryOvers(reports, plays, "2026-09-30").map((p) => p.id), ["diop", "bulaid"]);
});

test("once it has been reported with its result, it is not carried again", () => {
  const reports = [report("diop", "2026-09-29", "Open"), report("diop", "2026-09-30", "Win")];

  assert.deepEqual(selectCarryOvers(reports, [play("diop", "2026-09-29", "Win")], "2026-10-01"), []);
});

test("a play that is still open is not repeated day after day", () => {
  const reports = [report("slow", "2026-09-29", "Open")];

  assert.deepEqual(selectCarryOvers(reports, [play("slow", "2026-09-29", "Open")], "2026-09-30"), []);
});

test("plays dated the email's own day stay in its main table, not the carry-over", () => {
  const reports = [report("same-day", "2026-09-30", "Open", "2026-10-01T05:00:00Z")];

  assert.deepEqual(selectCarryOvers(reports, [play("same-day", "2026-09-30", "Win")], "2026-09-30"), []);
});

test("a play never sent as Open is never carried", () => {
  assert.deepEqual(selectCarryOvers([], [play("x", "2026-09-29", "Win")], "2026-09-30"), []);
});
