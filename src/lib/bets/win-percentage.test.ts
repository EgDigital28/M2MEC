import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeBetLedgerStats,
  computeDayResultsStats,
  computeSportBetStats,
  returnOnRisk,
  winPercentage,
  type BetEntryComputed,
} from "./calculations.ts";

test("a void counts in neither the wins nor the total", () => {
  assert.equal(Math.round(winPercentage(2, 1)! * 10000) / 100, 66.67);
});

test("no decided plays means no win percentage, not zero", () => {
  assert.equal(winPercentage(0, 0), null);
});

test("Sep 29: 2 wins, 1 loss, 1 void reads 66.67%", () => {
  const play = (status: BetEntryComputed["status"]) =>
    ({ status, risk: 100, to_win: 100, profit_loss: 0 }) as BetEntryComputed;
  const stats = computeDayResultsStats([play("Win"), play("Win"), play("Loss"), play("Void")]);

  assert.equal(stats.playCount, 4);
  assert.equal(stats.voidCount, 1);
  assert.equal(Math.round(stats.winPct! * 10000) / 100, 66.67);
});

const sep29 = () => {
  const play = (status: BetEntryComputed["status"], risk: number, profit_loss: number) =>
    ({ status, risk, profit_loss, to_win: 0, sport_id: "ufc", sport: "UFC" }) as BetEntryComputed;
  return [
    play("Win", 7500, 23250),
    play("Win", 100000, 23529.41),
    play("Loss", 20000, -20000),
    play("Void", 15000, 0),
  ];
};

test("ROI leaves out the voided stake: Sep 29 reads 21.00%, not 18.79%", () => {
  const stats = computeDayResultsStats(sep29());

  assert.equal(stats.decidedRisked, 127500);
  assert.equal(Math.round(stats.roi! * 10000) / 100, 21);
});

test("the ledger and per-sport ROI leave out voided and still-open stakes too", () => {
  const plays = [...sep29(), { status: "Open", risk: 50000, profit_loss: 0, to_win: 0, sport_id: "ufc", sport: "UFC" } as BetEntryComputed];
  const ledger = computeBetLedgerStats(plays);
  const [ufc] = computeSportBetStats(plays, [{ id: "ufc", abbreviation: "UFC", sort_order: 1 }]);

  assert.equal(Math.round(ledger.roi! * 10000) / 100, 21);
  assert.equal(Math.round(ufc.roi! * 10000) / 100, 21);
  // Still reported as risked; just not the base for ROI.
  assert.equal(ledger.totalRisked, 192500);
});

test("no decided plays means no ROI, not zero", () => {
  assert.equal(returnOnRisk(0, 0), null);
});
