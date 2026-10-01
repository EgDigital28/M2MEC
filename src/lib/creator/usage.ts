type OperationStats = { calls: number; credits: number };
type UsageRow = { operation: string; credits: number; outcome: string; occurredAt: string };
export type LedgerApiUsage = {
  plan: string;
  monthlyCreditLimit: number | null;
  periodStartsAt: string;
  usedCredits: number;
  calls: number;
  failedCalls: number;
  retryCalls: number;
  operationCosts: Record<string, number>;
  byOperation: Record<string, OperationStats>;
  recent: UsageRow[];
};

export async function readLedgerApiUsage(fetcher: typeof fetch = fetch): Promise<LedgerApiUsage> {
  const key = process.env.LEDGER_CONSUMER_KEY;
  if (!key || !/^lc_[a-f0-9]{64}$/.test(key)) throw new Error("Ledger consumer key is unavailable");
  const response = await fetcher("https://www.thepredictionledger.com/api/consumers/v1/usage", {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Ledger API usage request failed (${response.status})`);
  const body = await response.json();
  if (body?.schemaVersion !== "ledger-consumer-usage@1" || !body.data
    || typeof body.data.plan !== "string" || typeof body.data.calls !== "number"
    || typeof body.data.usedCredits !== "number" || !body.data.operationCosts)
    throw new Error("Ledger API usage response is invalid");
  return body.data as LedgerApiUsage;
}
