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

const withGames = (entry: BetEntryComputed, ...startsEt: string[]) =>
  ({ ...entry, ledger_events: startsEt.map((et) => ({ eventName: `game ${et}`, startsAt: at(et) })) }) as BetEntryComputed;

test("plays are ordered by game time, not by when they arrived", () => {
  const entries = [
    withGames(play("4pm game", "09:00", "Open", 100, 90), "16:00"),
    withGames(play("1pm game", "10:00", "Open", 100, 90), "13:00"),
    withGames(play("8pm game", "08:00", "Open", 100, 90), "20:00"),
  ];

  assert.deepEqual(splitTodaysPlays(entries, null).newPlays.map((p) => p.id), ["1pm game", "4pm game", "8pm game"]);
});

test("a finished game drops below the open ones, which keep game-time order", () => {
  const entries = [
    withGames(play("1pm game", "09:00", "Win", 100, 90, 90), "13:00"),
    withGames(play("4pm game", "09:30", "Open", 100, 90), "16:00"),
    withGames(play("noon game", "08:00", "Loss", 100, 90, -100), "12:00"),
  ];

  assert.deepEqual(splitTodaysPlays(entries, at("10:00")).earlierPlays.map((p) => p.id), ["4pm game", "noon game", "1pm game"]);
});

test("a parlay sorts by its latest game, whatever order its legs are listed in", () => {
  const entries = [
    withGames(play("parlay 1pm + 8pm", "09:00", "Open", 100, 90), "20:00", "13:00"),
    withGames(play("4pm single", "09:30", "Open", 100, 90), "16:00"),
  ];

  assert.deepEqual(splitTodaysPlays(entries, null).newPlays.map((p) => p.id), ["4pm single", "parlay 1pm + 8pm"]);
});

test("a graded game reads as its result, labelled Result; a pending one keeps Event", async () => {
  const { describeLedgerEvent, ledgerEventLabel, parseLedgerEvents } = await import("./ledger-events.ts");
  const [finished, pending] = parseLedgerEvents([
    {
      eventName: "North Texas Mean Green vs Tulsa Golden Hurricane",
      startsAt: "2026-10-02T01:00:00Z",
      result: {
        status: "original",
        observed: { event_status: "completed", away_score: 45, home_score: 44 },
        source: { awayParticipantLabel: "North Texas Mean Green", homeParticipantLabel: "Tulsa Golden Hurricane" },
      },
    },
    { eventName: "Los Angeles Chargers vs Buffalo Bills", startsAt: "2026-10-02T20:25:00Z", result: null },
  ]);

  assert.equal(`${ledgerEventLabel(0, 2, finished)}: ${describeLedgerEvent(finished)}`, "Result 1: North Texas Mean Green 45 – Tulsa Golden Hurricane 44 · Final");
  assert.equal(`${ledgerEventLabel(1, 2, pending)}: ${describeLedgerEvent(pending)}`, "Event 2: Los Angeles Chargers vs Buffalo Bills · Oct 2, 2026, 4:25 PM ET");
  assert.equal(ledgerEventLabel(0, 1, finished), "Result");
});
