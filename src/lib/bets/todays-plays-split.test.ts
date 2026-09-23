import assert from "node:assert/strict";
import { test } from "node:test";
import type { BetEntryComputed } from "./calculations.ts";
import { splitTodaysPlays, todaysPlaysTotals } from "./todays-plays-split.ts";

function play(
  name: string,
  arrivedEt: string,
  status: BetEntryComputed["status"],
  risk: number,
  toWin: number,
  profitLoss = 0,
): BetEntryComputed {
  return {
    id: name,
    event_name: name,
    // Eastern daylight time is UTC-4 on the test date.
    created_at: new Date(`2026-09-23T${arrivedEt}:00-04:00`).toISOString(),
    status,
    risk,
    to_win: toWin,
    profit_loss: profitLoss,
  } as BetEntryComputed;
}

const at = (et: string) => new Date(`2026-09-23T${et}:00-04:00`).toISOString();

test("the first check of the day sends everything as the first email", () => {
  const entries = [play("A", "12:48", "Open", 100, 90), play("B", "12:50", "Open", 100, 90)];
  const split = splitTodaysPlays(entries, null);

  assert.equal(split.isFirst, true);
  assert.deepEqual(split.newPlays.map((p) => p.id), ["A", "B"]);
  assert.deepEqual(split.earlierPlays, []);
});

test("graded plays sit below open ones in the first email too", () => {
  const entries = [play("early game", "11:30", "Win", 100, 90, 90), play("late game", "12:00", "Open", 100, 90)];

  assert.deepEqual(splitTodaysPlays(entries, null).newPlays.map((p) => p.id), ["late game", "early game"]);
});

test("nothing is new when no play arrived after the last email", () => {
  const entries = [play("A", "12:48", "Open", 100, 90)];
  const split = splitTodaysPlays(entries, at("14:00"));

  assert.equal(split.isFirst, false);
  assert.deepEqual(split.newPlays, []);
});

test("a play graded between checks does not hide a new one (the counting trap)", () => {
  // 2pm sent the 1pm game and a 7pm game. By 4pm the 1pm game has won and a
  // 2:30 play has arrived: the open count is still 2, but one play is new.
  const entries = [
    play("1pm game", "11:30", "Win", 10000, 9090.91, 9090.91),
    play("7pm game", "12:00", "Open", 10000, 9090.91),
    play("2:30 play", "14:30", "Open", 5000, 6000),
  ];
  const split = splitTodaysPlays(entries, at("14:00"));

  assert.deepEqual(split.newPlays.map((p) => p.id), ["2:30 play"]);
  // Still-open plays first, graded plays at the bottom.
  assert.deepEqual(split.earlierPlays.map((p) => p.id), ["7pm game", "1pm game"]);
});

test("a play that arrived and was graded between checks still counts as new", () => {
  const entries = [play("quick game", "14:30", "Loss", 1000, 909.09, -1000)];
  const split = splitTodaysPlays(entries, at("14:00"));

  assert.deepEqual(split.newPlays.map((p) => p.id), ["quick game"]);
});

test("totals separate what is still riding from what has settled", () => {
  const totals = todaysPlaysTotals([
    play("1pm game", "11:30", "Win", 10000, 9090.91, 9090.91),
    play("7pm game", "12:00", "Open", 10000, 9090.91),
    play("2:30 play", "14:30", "Open", 5000, 6000),
    play("voided", "12:10", "Void", 2000, 1800, 0),
  ]);

  assert.equal(totals.openCount, 2);
  assert.equal(totals.openRisk, 15000);
  assert.equal(Math.round(totals.openToWin * 100) / 100, 15090.91);
  assert.equal(totals.wins, 1);
  assert.equal(totals.losses, 0);
  assert.equal(totals.voids, 1);
  assert.equal(totals.settledNet, 9090.91);
  assert.equal(totals.settledCount, 2);
});
