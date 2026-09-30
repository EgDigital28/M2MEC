import { NextResponse } from "next/server";
import { getTodayDateString } from "@/lib/bets/calculations";
import { logBetEmailSends } from "@/lib/bets/email-sends";
import { buildTodaysPlaysDigests } from "@/lib/bets/todays-plays-digest";
import { easternHour, isAuthorizedCron } from "@/lib/cron";
import { AUTOMATED_RECIPIENTS, isAutomationEnabled } from "@/lib/email/automation";
import {
  todaysPlaysHtml,
  todaysPlaysSubject,
  todaysPlaysText,
} from "@/lib/email/todays-plays";
import { getResendClient, getResendFromEmail } from "@/lib/email/utils";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Check hours in Eastern time. vercel.json fires this across the UTC hours
 * that cover both EST and EDT; this gate keeps exactly these five.
 */
const CHECK_HOURS_ET = [11, 14, 16, 19, 21];

/**
 * Sends today's plays to each person who has new plays since their last
 * today's plays email. Nothing new means nothing is sent and nothing is logged.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hour = easternHour();

  if (!CHECK_HOURS_ET.includes(hour)) {
    return NextResponse.json({ skipped: "Outside the check hours", hour });
  }

  const db = createAdminClient();

  try {
    if (!(await isAutomationEnabled(db, "upcoming_plays"))) {
      return NextResponse.json({ skipped: "Switched off", hour });
    }
  } catch (settingsError) {
    console.error("cron.todays-plays.settings_failed", settingsError);
    return NextResponse.json({ error: "Could not check the automation switch." }, { status: 503 });
  }

  const today = getTodayDateString();
  // Taken before the plays are read, and recorded as the send time. A play
  // that lands while the emails are going out is then newer than this, so the
  // next check picks it up instead of treating it as sent.
  const checkedAt = new Date().toISOString();

  let digests;

  try {
    digests = await buildTodaysPlaysDigests(db, AUTOMATED_RECIPIENTS, today);
  } catch (loadError) {
    console.error("cron.todays-plays.load_failed", loadError);
    return NextResponse.json({ error: "Could not load today's plays." }, { status: 503 });
  }

  const due = digests.filter((digest) => digest.shouldSend);

  if (due.length === 0) {
    return NextResponse.json({ skipped: "No new plays", hour, today });
  }

  const resend = getResendClient();

  if (!resend) {
    console.error("cron.todays-plays.resend_unconfigured");
    return NextResponse.json({ error: "Email service is not configured." }, { status: 503 });
  }

  const sent: string[] = [];
  const failed: string[] = [];

  // One email per person, each built from that person's own history, so a
  // failed send to one of them is retried as new at the next check without
  // repeating anything for the other.
  for (const digest of due) {
    const params = { sentOnDate: today, ...digest };

    const { error: emailError } = await resend.emails.send({
      from: getResendFromEmail(),
      to: [digest.recipient],
      subject: todaysPlaysSubject(params),
      html: todaysPlaysHtml(params),
      text: todaysPlaysText(params),
    });

    if (emailError) {
      console.error("cron.todays-plays.send_failed", digest.recipient, emailError);
      failed.push(digest.recipient);
      continue;
    }

    sent.push(digest.recipient);

    try {
      await logBetEmailSends({
        emailType: "upcoming_plays",
        recipients: [digest.recipient],
        sentById: null,
        playCount: digest.newPlays.length + digest.earlierPlays.length,
        contextDate: today,
        isAutomated: true,
        client: db,
        sentAt: checkedAt,
      });
    } catch (logError) {
      // The email is already out. Without the log row, the next check would
      // treat these plays as new again and send them a second time.
      console.error("cron.todays-plays.log_failed", digest.recipient, logError);
    }
  }

  if (sent.length === 0) {
    return NextResponse.json({ error: "Could not send email.", failed }, { status: 502 });
  }

  return NextResponse.json({ sent, failed, hour, today });
}
