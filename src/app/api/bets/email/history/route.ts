import { NextResponse } from "next/server";
import {
  fetchBetEmailSendHistory,
  isMissingBetEmailSendsTable,
} from "@/lib/bets/email-sends";
import { requireMinimumTier } from "@/lib/auth/profile";

export async function GET() {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  try {
    const history = await fetchBetEmailSendHistory();
    return NextResponse.json({ history });
  } catch (error) {
    console.error("Bet email history fetch failed:", error);

    if (error instanceof Error && isMissingBetEmailSendsTable(error.message)) {
      return NextResponse.json(
        { error: "Email history is not set up. Run 018_bet_email_sends.sql in Supabase." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Could not load email history." }, { status: 500 });
  }
}
