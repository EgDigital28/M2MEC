import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getYesterdayDateString,
  withComputedFields,
  type BetEntryRow,
} from "@/lib/bets/calculations";
import { logBetEmailSends } from "@/lib/bets/email-sends";
import {
  yesterdaysResultsHtml,
  yesterdaysResultsSubject,
  yesterdaysResultsText,
} from "@/lib/email/yesterdays-results";
import {
  ungradedAlertHtml,
  ungradedAlertSubject,
  ungradedAlertText,
} from "@/lib/email/ungraded-alert";
import { getResendClient, getResendFromEmail } from "@/lib/email/utils";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Hardcoded while the schedule is being proven out; widen to configured
// recipients once the timing and grading behaviour are trusted.
const RECIPIENTS = ["eli.goshert@gmail.com"];

/**
 * Attempt hours in Eastern time. Vercel schedules in UTC, so the cron fires
 * across a wider UTC window and this gate selects exactly three runs a day in
 * both EST and EDT. The last hour is the give-up attempt.
 */
const ATTEMPT_HOURS_ET = [1, 2, 3];

function easternHour(now = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
}

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  return (
    Boolean(secret) &&
    Buffer.byteLength(supplied) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  );
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hour = easternHour();
  const attempt = ATTEMPT_HOURS_ET.indexOf(hour) + 1;

  if (attempt === 0) {
    return NextResponse.json({ skipped: "Outside the attempt window", hour });
  }

  const finalAttempt = attempt === ATTEMPT_HOURS_ET.length;
  const resultsDate = getYesterdayDateString();
  const db = createAdminClient();

  // One send per results date, whoever sent it. A manual send earlier in the
  // day stands down the job rather than producing a duplicate.
  const alreadySent = await db
    .from("bet_email_sends")
    .select("id")
    .eq("email_type", "yesterdays_results")
    .eq("context_date", resultsDate)
    .limit(1);

  if (alreadySent.error) {
    console.error("cron.yesterdays-results.history_failed", alreadySent.error.message);
    return NextResponse.json({ error: "Could not check send history." }, { status: 503 });
  }

  if (alreadySent.data.length > 0) {
    return NextResponse.json({ skipped: "Already sent", resultsDate, attempt });
  }

  const { data, error } = await db
    .from("bet_entries")
    .select("*, sports(abbreviation, full_name)")
    .eq("event_date", resultsDate)
    .order("sport_id", { ascending: true })
    .order("event_name", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("cron.yesterdays-results.fetch_failed", error.message);
    return NextResponse.json({ error: "Could not load yesterday's results." }, { status: 503 });
  }

  const entries = (data as BetEntryRow[]).map((row) => withComputedFields(row));

  if (entries.length === 0) {
    return NextResponse.json({ skipped: "No plays", resultsDate, attempt });
  }

  const ungraded = entries.filter((entry) => entry.status === "Open");

  // Hold for grading until the final attempt, then report instead of sending
  // a half-graded digest.
  if (ungraded.length > 0 && !finalAttempt) {
    return NextResponse.json({
      skipped: "Ungraded plays",
      resultsDate,
      attempt,
      ungradedCount: ungraded.length,
    });
  }

  const resend = getResendClient();

  if (!resend) {
    console.error("cron.yesterdays-results.resend_unconfigured");
    return NextResponse.json({ error: "Email service is not configured." }, { status: 503 });
  }

  if (ungraded.length > 0) {
    const alertParams = {
      ungraded,
      playCount: entries.length,
      resultsDate,
      attempts: ATTEMPT_HOURS_ET.length,
    };

    const { error: alertError } = await resend.emails.send({
      from: getResendFromEmail(),
      to: RECIPIENTS,
      subject: ungradedAlertSubject(alertParams),
      html: ungradedAlertHtml(alertParams),
      text: ungradedAlertText(alertParams),
    });

    if (alertError) {
      console.error("cron.yesterdays-results.alert_failed", alertError);
      return NextResponse.json({ error: "Could not send alert." }, { status: 502 });
    }

    // Deliberately not logged to bet_email_sends: no digest was sent, and a
    // row there would suppress a later manual send for this date.
    return NextResponse.json({
      alerted: true,
      resultsDate,
      attempt,
      ungradedCount: ungraded.length,
    });
  }

  const emailParams = { entries, resultsDate };

  const { error: emailError } = await resend.emails.send({
    from: getResendFromEmail(),
    to: RECIPIENTS,
    subject: yesterdaysResultsSubject(emailParams),
    html: yesterdaysResultsHtml(emailParams),
    text: yesterdaysResultsText(emailParams),
  });

  if (emailError) {
    console.error("cron.yesterdays-results.send_failed", emailError);
    return NextResponse.json({ error: "Could not send email." }, { status: 502 });
  }

  try {
    await logBetEmailSends({
      emailType: "yesterdays_results",
      recipients: RECIPIENTS,
      sentById: null,
      playCount: entries.length,
      contextDate: resultsDate,
      isAutomated: true,
      client: db,
    });
  } catch (logError) {
    // The mail is already out; a logging failure must not look like a send
    // failure. It does mean a later attempt could duplicate this send.
    console.error("cron.yesterdays-results.log_failed", logError);
  }

  return NextResponse.json({
    sent: true,
    resultsDate,
    attempt,
    recipientCount: RECIPIENTS.length,
    playCount: entries.length,
  });
}
