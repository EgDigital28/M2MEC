import { NextResponse } from "next/server";
import {
  DEFAULT_OUTCOMES_API_URL,
  requestOutcomeGrade,
  type OpenBetForGrading,
} from "@/lib/bets/outcome-grading";
import { tryCreateAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BATCH_SIZE = 100;
const CONCURRENCY = 5;

type GradingSummary = {
  checked: number;
  graded: number;
  unresolved: number;
  skipped: number;
  failed: number;
  updates: Array<{ id: string; status: string }>;
  failures: Array<{ id: string; reason: string }>;
};

function easternDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const apiKey = process.env.LEDGER_CONSUMER_API_KEY;
  const apiUrl = process.env.PREDICTION_LEDGER_OUTCOMES_URL ?? DEFAULT_OUTCOMES_API_URL;
  const supabase = tryCreateAdminClient();
  if (!apiKey || !supabase) {
    return NextResponse.json({ error: "Outcome grading is not configured." }, { status: 503 });
  }

  try {
    new URL(apiUrl);
  } catch {
    return NextResponse.json({ error: "PREDICTION_LEDGER_OUTCOMES_URL is invalid." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("bet_entries")
    .select("id, event_date, event_name, sports(abbreviation)")
    .eq("status", "Open")
    .lte("event_date", easternDate())
    .order("event_date", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("Open bets fetch for outcome grading failed:", error);
    return NextResponse.json({ error: "Could not load open bets." }, { status: 500 });
  }

  const bets = (data ?? []) as unknown as OpenBetForGrading[];
  const summary: GradingSummary = {
    checked: bets.length,
    graded: 0,
    unresolved: 0,
    skipped: 0,
    failed: 0,
    updates: [],
    failures: [],
  };

  for (let index = 0; index < bets.length; index += CONCURRENCY) {
    const batch = bets.slice(index, index + CONCURRENCY);
    const attempts = await Promise.all(
      batch.map((bet) => requestOutcomeGrade(bet, { apiUrl, apiKey })),
    );

    for (let offset = 0; offset < batch.length; offset += 1) {
      const bet = batch[offset]!;
      const attempt = attempts[offset]!;
      if (attempt.kind === "unresolved") {
        summary.unresolved += 1;
        continue;
      }
      if (attempt.kind === "skipped") {
        summary.skipped += 1;
        continue;
      }
      if (attempt.kind === "failed") {
        summary.failed += 1;
        summary.failures.push({ id: bet.id, reason: attempt.reason });
        continue;
      }

      const { data: updated, error: updateError } = await supabase
        .from("bet_entries")
        .update({ status: attempt.status, updated_at: new Date().toISOString() })
        .eq("id", bet.id)
        .eq("status", "Open")
        .select("id")
        .maybeSingle();

      if (updateError) {
        console.error(`Automated grade update failed for bet ${bet.id}:`, updateError);
        summary.failed += 1;
        summary.failures.push({ id: bet.id, reason: "Could not persist the grade." });
      } else if (updated) {
        summary.graded += 1;
        summary.updates.push({ id: bet.id, status: attempt.status });
      }
    }
  }

  return NextResponse.json(
    { ok: summary.failed === 0, summary },
    {
      status: summary.failed === 0 ? 200 : 502,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
