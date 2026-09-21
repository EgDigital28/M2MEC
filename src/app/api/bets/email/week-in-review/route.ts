import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import {
  computeDailyPlSeries,
  getPreviousWeekRange,
  getRollingWeekRange,
  withComputedFields,
  type BetEntryRow,
} from "@/lib/bets/calculations";
import { logBetEmailSends } from "@/lib/bets/email-sends";
import {
  weekInReviewHtml,
  weekInReviewSubject,
  weekInReviewText,
} from "@/lib/email/week-in-review";
import { getResendClient, getResendFromEmail, parseEmailRecipients } from "@/lib/email/utils";
import { createClient } from "@/lib/supabase/server";
import type { Sport } from "@/lib/sports/types";

type WeekInReviewPayload = {
  to?: string;
  view?: string;
};

export async function POST(request: Request) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  let body: WeekInReviewPayload;

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

  // Mirror whichever range the page is showing.
  const rolling = body.view !== "week";
  const { weekStart, weekEnd } = rolling
    ? getRollingWeekRange()
    : getPreviousWeekRange();

  const supabase = await createClient();
  const [entriesResult, sportsResult] = await Promise.all([
    supabase
      .from("bet_entries")
      .select("*, sports(abbreviation, full_name)")
      .gte("event_date", weekStart)
      .lte("event_date", weekEnd)
      .order("event_date", { ascending: true }),
    supabase.from("sports").select("*").order("sort_order"),
  ]);

  if (entriesResult.error || sportsResult.error) {
    console.error(
      "Week in review fetch failed:",
      entriesResult.error?.message ?? sportsResult.error?.message,
    );
    return NextResponse.json({ error: "Could not load the week." }, { status: 500 });
  }

  const entries = (entriesResult.data as BetEntryRow[]).map(withComputedFields);
  const emailParams = {
    entries,
    sports: (sportsResult.data ?? []) as Sport[],
    weekStart,
    weekEnd,
    series: computeDailyPlSeries(entries, weekStart, weekEnd),
    viewLabel: rolling ? "Rolling 7 days to yesterday" : "Last Monday – Sunday",
  };

  const { error: emailError } = await resend.emails.send({
    from: getResendFromEmail(),
    to: recipients,
    bcc: "eli.goshert@gmail.com",
    subject: weekInReviewSubject(emailParams),
    html: weekInReviewHtml(emailParams),
    text: weekInReviewText(emailParams),
  });

  if (emailError) {
    console.error("Week in review email failed:", emailError);
    return NextResponse.json({ error: "Could not send email." }, { status: 502 });
  }

  try {
    await logBetEmailSends({
      emailType: "week_in_review",
      recipients,
      sentById: auth.profile.id,
      playCount: entries.length,
      contextDate: weekStart,
      contextWeekEnd: weekEnd,
    });
  } catch (logError) {
    console.error("Week in review email log failed:", logError);
  }

  return NextResponse.json({
    ok: true,
    recipientCount: recipients.length,
    playCount: entries.length,
    weekStart,
    weekEnd,
  });
}
