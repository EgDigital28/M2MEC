import assert from "node:assert/strict";
import { test } from "node:test";
import { computeDayResultsStats, winPercentage, type BetEntryComputed } from "./calculations.ts";

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
