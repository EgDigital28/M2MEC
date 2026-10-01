import test from "node:test";
import assert from "node:assert/strict";
import { readLedgerApiUsage } from "./usage.ts";

test("usage request keeps the consumer key server-side and reads only the company response", async () => {
  const before = process.env.LEDGER_CONSUMER_KEY;
  const key = `lc_${"a".repeat(64)}`;
  process.env.LEDGER_CONSUMER_KEY = key;
  try {
    const usage = await readLedgerApiUsage(async (input, init) => {
      assert.equal(input, "https://www.thepredictionledger.com/api/consumers/v1/usage");
      assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${key}`);
      assert.equal(init?.cache, "no-store");
      return Response.json({ schemaVersion: "ledger-consumer-usage@1", data: {
        plan: "free", monthlyCreditLimit: null, periodStartsAt: "2026-10-01T00:00:00Z",
        usedCredits: 0, calls: 2, failedCalls: 0, retryCalls: 0,
        operationCosts: { feed_read: 0 }, byOperation: { feed_read: { calls: 2, credits: 0 } }, recent: [],
      } });
    });
    assert.equal(usage.calls, 2);
    assert.deepEqual(usage.operationCosts, { feed_read: 0 });
  } finally {
    if (before === undefined) delete process.env.LEDGER_CONSUMER_KEY;
    else process.env.LEDGER_CONSUMER_KEY = before;
  }
});
