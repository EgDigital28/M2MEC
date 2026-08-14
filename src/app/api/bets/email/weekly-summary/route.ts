import { NextResponse } from "next/server";
import {
  getCurrentWeekRange,
  withComputedFields,
  type BetEntryRow,
} from "@/lib/bets/calculations";
import { requireMinimumTier } from "@/lib/auth/profile";
import {
  weeklySummaryHtml,
  weeklySummarySubject,
  weeklySummaryText,
} from "@/lib/email/weekly-summary";
import {
  getResendClient,
  getResendFromEmail,
  parseEmailRecipients,
} from "@/lib/email/utils";
import { createClient } from "@/lib/supabase/server";

type WeeklySummaryPayload = {
  to?: string;
};

export async function POST(request: Request) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    if (auth.error === "unauthenticated") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let body: WeeklySummaryPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  let recipients: string[];

  try {
    recipients = parseEmailRecipients(body.to ?? "");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid recipients.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: "At least one recipient is required." }, { status: 400 });
  }

  const resend = getResendClient();

  if (!resend) {
    console.error("RESEND_API_KEY is not configured");
    return NextResponse.json({ error: "Email service is not configured." }, { status: 500 });
  }

  const weekRange = getCurrentWeekRange();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bet_entries")
    .select("*, sports(abbreviation, full_name)")
    .gte("event_date", weekRange.weekStart)
    .lte("event_date", weekRange.weekEnd)
    .order("event_date", { ascending: true })
    .order("sport_id", { ascending: true })
    .order("event_name", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Weekly summary fetch failed:", error);
    return NextResponse.json({ error: "Could not load weekly plays." }, { status: 500 });
  }

  const entries = (data as BetEntryRow[]).map((row) => withComputedFields(row));
  const emailParams = { entries, weekRange };

  const { error: emailError } = await resend.emails.send({
    from: getResendFromEmail(),
    to: recipients,
    subject: weeklySummarySubject(emailParams),
    html: weeklySummaryHtml(emailParams),
    text: weeklySummaryText(emailParams),
  });

  if (emailError) {
    console.error("Weekly summary email failed:", emailError);
    return NextResponse.json({ error: "Could not send email." }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    recipientCount: recipients.length,
    playCount: entries.length,
    weekStart: weekRange.weekStart,
    weekEnd: weekRange.weekEnd,
  });
}
