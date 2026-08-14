import { NextResponse } from "next/server";
import {
  getTodayDateString,
  withComputedFields,
  type BetEntryRow,
} from "@/lib/bets/calculations";
import { requireMinimumTier } from "@/lib/auth/profile";
import {
  todaysPlaysHtml,
  todaysPlaysSubject,
  todaysPlaysText,
} from "@/lib/email/todays-plays";
import {
  getResendClient,
  getResendFromEmail,
  parseEmailRecipients,
} from "@/lib/email/utils";
import { createClient } from "@/lib/supabase/server";

type TodaysPlaysPayload = {
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

  let body: TodaysPlaysPayload;

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

  const today = getTodayDateString();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bet_entries")
    .select("*, sports(abbreviation, full_name)")
    .eq("status", "Open")
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Open plays fetch failed:", error);
    return NextResponse.json({ error: "Could not load open plays." }, { status: 500 });
  }

  const entries = (data as BetEntryRow[]).map((row) => withComputedFields(row));
  const emailParams = { entries, sentOnDate: today };

  const { error: emailError } = await resend.emails.send({
    from: getResendFromEmail(),
    to: recipients,
    subject: todaysPlaysSubject(emailParams),
    html: todaysPlaysHtml(emailParams),
    text: todaysPlaysText(emailParams),
  });

  if (emailError) {
    console.error("Today's plays email failed:", emailError);
    return NextResponse.json({ error: "Could not send email." }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    recipientCount: recipients.length,
    playCount: entries.length,
  });
}
