import { NextResponse } from "next/server";
import { requireInvestorTier } from "@/lib/auth/investor";
import { fetchInvestorFinancials } from "@/lib/financials/investor-summary";
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
    const summary = await fetchInvestorFinancials(auth.profile.id);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Investor financials fetch failed:", error);

    if (error instanceof Error && error.message === "service_role_unconfigured") {
      return NextResponse.json({ error: SERVICE_ROLE_MISSING_MESSAGE }, { status: 503 });
    }

    const message = error instanceof Error ? error.message : "";

    if (message.includes("equity_stakes") || message.includes("wagering_stakes")) {
      return NextResponse.json(
        { error: "Financial data is not set up yet. Contact your administrator." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Could not load financial summary." }, { status: 500 });
  }
}
