import { NextResponse } from "next/server";
import { findBetEmailDuplicatesToday } from "@/lib/bets/email-sends";
import { isBetEmailType, isMissingBetEmailSendsTable } from "@/lib/bets/email-sends-types";
import { requireMinimumTier } from "@/lib/auth/profile";
import { parseEmailRecipients } from "@/lib/email/utils";

export async function GET(request: Request) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const emailType = searchParams.get("type") ?? "";
  const to = searchParams.get("to") ?? "";

  if (!isBetEmailType(emailType)) {
    return NextResponse.json({ error: "Invalid email type." }, { status: 400 });
  }

  let recipients: string[];

  try {
    recipients = parseEmailRecipients(to);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid recipients.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (recipients.length === 0) {
    return NextResponse.json({ duplicates: [] });
  }

  try {
    const duplicates = await findBetEmailDuplicatesToday(emailType, recipients);
    return NextResponse.json({ duplicates });
  } catch (error) {
    console.error("Bet email duplicate check failed:", error);

    if (error instanceof Error && isMissingBetEmailSendsTable(error.message)) {
      return NextResponse.json({ duplicates: [] });
    }

    return NextResponse.json({ error: "Could not check send history." }, { status: 500 });
  }
}
