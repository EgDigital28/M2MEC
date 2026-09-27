import { NextResponse } from "next/server";
import { logBetEmailSends } from "@/lib/bets/email-sends";
import { loadWeekInReview } from "@/lib/bets/week-in-review-data";
import { easternHour, easternWeekday, isAuthorizedCron } from "@/lib/cron";
import { AUTOMATED_RECIPIENTS, isAutomationEnabled } from "@/lib/email/automation";
import { getResendClient, getResendFromEmail } from "@/lib/email/utils";
import {
  weekInReviewHtml,
  weekInReviewSubject,
  weekInReviewText,
} from "@/lib/email/week-in-review";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sunday attempt hours in Eastern time. vercel.json fires across the UTC hours
 * that cover both EST and EDT; this gate keeps exactly these three.
 */
const ATTEMPT_HOURS_ET = [1, 2, 3];

/**
 * Sends the week just ended (Sunday to Saturday) to each recipient, once.
 *
 * Saturday's late games may not be graded by 1am, so while any play in the
 * week is still open it waits for the next attempt. The last attempt sends
 * regardless: a weekly summary with an open play counted as open is more
 * useful than no summary at all.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hour = easternHour();
  const attempt = ATTEMPT_HOURS_ET.indexOf(hour) + 1;

  if (easternWeekday() !== 0 || attempt === 0) {
    return NextResponse.json({ skipped: "Outside the attempt window", hour });
  }

  const finalAttempt = attempt === ATTEMPT_HOURS_ET.length;
  const db = createAdminClient();

  try {
    if (!(await isAutomationEnabled(db, "week_in_review"))) {
      return NextResponse.json({ skipped: "Switched off", attempt });
    }
  } catch (settingsError) {
    console.error("cron.week-in-review.settings_failed", settingsError);
    return NextResponse.json({ error: "Could not check the automation switch." }, { status: 503 });
  }

  let params;

  try {
    params = await loadWeekInReview(db, { rolling: true });
  } catch (loadError) {
    console.error("cron.week-in-review.load_failed", loadError);
    return NextResponse.json({ error: "Could not load the week." }, { status: 503 });
  }

  const { weekStart, weekEnd, entries } = params;

  // One send per recipient per week, whoever sent it: a manual send of this
  // week already counts, and a failed delivery is retried next attempt
  // without re-mailing anyone who already has it.
  const history = await db
    .from("bet_email_sends")
    .select("recipient_email")
    .eq("email_type", "week_in_review")
    .eq("context_date", weekStart)
    .eq("context_week_end", weekEnd);

  if (history.error) {
    console.error("cron.week-in-review.history_failed", history.error.message);
    return NextResponse.json({ error: "Could not check send history." }, { status: 503 });
  }

  const delivered = new Set(history.data.map((row) => String(row.recipient_email).toLowerCase()));
  const pending = AUTOMATED_RECIPIENTS.filter((recipient) => !delivered.has(recipient.toLowerCase()));

  if (pending.length === 0) {
    return NextResponse.json({ skipped: "Already sent", weekStart, weekEnd, attempt });
  }

  const openCount = entries.filter((entry) => entry.status === "Open").length;

  if (openCount > 0 && !finalAttempt) {
    return NextResponse.json({ skipped: "Ungraded plays", weekStart, weekEnd, attempt, openCount });
  }

  const resend = getResendClient();

  if (!resend) {
    console.error("cron.week-in-review.resend_unconfigured");
    return NextResponse.json({ error: "Email service is not configured." }, { status: 503 });
  }

  const subject = weekInReviewSubject(params);
  const html = weekInReviewHtml(params);
  const text = weekInReviewText(params);
  const sent: string[] = [];
  const failed: string[] = [];

  for (const recipient of pending) {
    const { error: emailError } = await resend.emails.send({
      from: getResendFromEmail(),
      to: [recipient],
      subject,
      html,
      text,
    });

    if (emailError) {
      console.error("cron.week-in-review.send_failed", recipient, emailError);
      failed.push(recipient);
      continue;
    }

    sent.push(recipient);

    try {
      await logBetEmailSends({
        emailType: "week_in_review",
        recipients: [recipient],
        sentById: null,
        playCount: entries.length,
        contextDate: weekStart,
        contextWeekEnd: weekEnd,
        isAutomated: true,
        client: db,
      });
    } catch (logError) {
      // Already sent; without the log row a later attempt could send it again.
      console.error("cron.week-in-review.log_failed", recipient, logError);
    }
  }

  if (sent.length === 0) {
    return NextResponse.json({ error: "Could not send email.", failed }, { status: 502 });
  }

  return NextResponse.json({ sent, failed, weekStart, weekEnd, attempt, openCount });
}
