import { NextResponse } from "next/server";
import { requireInvestorTier } from "@/lib/auth/investor";
import { computeDayResultsStats } from "@/lib/bets/calculations";
import { fetchUpcomingPlays, fetchYesterdaysResults } from "@/lib/bets/investor-plays";
import { SERVICE_ROLE_MISSING_MESSAGE } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireInvestorTier();

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Investor access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  try {
    const [{ resultsDate, entries: yesterdaysResults }, upcomingPlays] = await Promise.all([
      fetchYesterdaysResults(),
      fetchUpcomingPlays(),
    ]);

    return NextResponse.json({
      resultsDate,
      yesterdaysResults,
      yesterdaysStats: computeDayResultsStats(yesterdaysResults),
      upcomingPlays,
    });
  } catch (error) {
    console.error("Investor plays fetch failed:", error);

    if (error instanceof Error && error.message === "service_role_unconfigured") {
      return NextResponse.json({ error: SERVICE_ROLE_MISSING_MESSAGE }, { status: 503 });
    }

    const message = error instanceof Error ? error.message : "";

    if (message.includes("bet_entries")) {
      return NextResponse.json({ error: "Play data is not set up yet." }, { status: 503 });
    }

    return NextResponse.json({ error: "Could not load plays." }, { status: 500 });
  }
}
