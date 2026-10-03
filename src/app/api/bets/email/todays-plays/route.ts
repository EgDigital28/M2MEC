import { NextResponse } from "next/server";
import { getTodayDateString } from "@/lib/bets/calculations";
import { loadLookahead, loadTodaysPlays } from "@/lib/bets/todays-plays-digest";
import { splitTodaysPlays } from "@/lib/bets/todays-plays-split";
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
import { logBetEmailSends } from "@/lib/bets/email-sends";
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
  // Taken before the plays are read and recorded as the send time, so a play
  // that lands mid-send is still new to the scheduled check afterwards.
  const checkedAt = new Date().toISOString();
  const supabase = await createClient();
  let entries;

  try {
    // Every play dated today, graded or not: the same full list the first
    // scheduled email of the day carries.
    entries = await loadTodaysPlays(supabase, today);
  } catch (error) {
    console.error("Today's plays fetch failed:", error);
    return NextResponse.json({ error: "Could not load today's plays." }, { status: 500 });
  }

  // Through the same split as the scheduled email, with no previous send, so
  // the manual one is ordered the same way: open plays by game time first,
  // graded plays at the bottom.
  let lookahead;

  try {
    lookahead = await loadLookahead(supabase, today);
  } catch (error) {
    console.error("Tomorrow's plays fetch failed:", error);
    return NextResponse.json({ error: "Could not load tomorrow's plays." }, { status: 500 });
  }

  const emailParams = { sentOnDate: today, ...splitTodaysPlays(entries, null), lookahead };

  const { error: emailError } = await resend.emails.send({
    from: getResendFromEmail(),
    to: recipients,
    bcc: "eli.goshert@gmail.com",
    subject: todaysPlaysSubject(emailParams),
    html: todaysPlaysHtml(emailParams),
    text: todaysPlaysText(emailParams),
  });

  if (emailError) {
    console.error("Today's plays email failed:", emailError);
    return NextResponse.json({ error: "Could not send email." }, { status: 502 });
  }

  try {
    await logBetEmailSends({
      emailType: "upcoming_plays",
      recipients,
      sentById: auth.profile.id,
      playCount: entries.length,
      contextDate: today,
      sentAt: checkedAt,
    });
  } catch (logError) {
    console.error("Today's plays email log failed:", logError);
  }

  return NextResponse.json({
    ok: true,
    recipientCount: recipients.length,
    playCount: entries.length,
  });
}
