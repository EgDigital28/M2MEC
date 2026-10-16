import assert from "node:assert/strict";
import { test } from "node:test";
import { sortBetEntries } from "./calculations.ts";

const et = (day: string, time: string) => new Date(`2026-10-${day}T${time}:00-04:00`).toISOString();
const play = (id: string, event_date: string, status: string, ...starts: string[]) => ({
  id,
  event_date,
  status,
  created_at: "2026-10-16T08:00:00Z",
  ledger_events: starts.map((startsAt) => ({ eventName: id, startsAt })),
});

// The ledger on the morning of Oct 16.
const tennis = play("tennis 6am", "2026-10-16", "Open", et("16", "06:00"));
const hockey = play("hockey 9pm", "2026-10-16", "Open", et("16", "21:00"));
const mma = play("ufc sat 8pm", "2026-10-17", "Open", et("17", "20:00"));
const parlay = play("mixed parlay", "2026-10-18", "Open", et("17", "20:00"), et("18", "13:00"));
const panthers = play("panthers (won 10/15)", "2026-10-15", "Win", et("15", "19:00"));

test("open plays come first, soonest game first across days; graded ones follow", () => {
  assert.deepEqual(
    sortBetEntries([parlay, panthers, mma, hockey, tennis]).map((p) => p.id),
    ["tennis 6am", "hockey 9pm", "ufc sat 8pm", "mixed parlay", "panthers (won 10/15)"],
  );
});

test("once the tennis play is graded it leaves the top, and hockey leads", () => {
  const graded = { ...tennis, status: "Win" };
  assert.deepEqual(
    sortBetEntries([parlay, panthers, mma, hockey, graded]).map((p) => p.id),
    ["hockey 9pm", "ufc sat 8pm", "mixed parlay", "tennis 6am", "panthers (won 10/15)"],
  );
});
