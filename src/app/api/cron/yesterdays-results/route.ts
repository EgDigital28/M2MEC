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
import {
  AUTOMATED_RECIPIENTS,
  AUTOMATION_ALERT_RECIPIENTS,
  isAutomationEnabled,
} from "@/lib/email/automation";
import { getResendClient, getResendFromEmail } from "@/lib/email/utils";
import { easternHour, isAuthorizedCron } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RECIPIENTS = AUTOMATED_RECIPIENTS;
const ALERT_RECIPIENTS = AUTOMATION_ALERT_RECIPIENTS;

/**
 * Attempt hours in Eastern time. Vercel schedules in UTC, so the cron fires
 * across a wider UTC window and this gate selects exactly three runs a day in
 * both EST and EDT. The last hour is the give-up attempt.
 */
const ATTEMPT_HOURS_ET = [1, 2, 3];

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
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

  // Switched off on the Email automation page. Checked before anything else,
  // and a failed lookup stands the run down rather than guessing.
  try {
    if (!(await isAutomationEnabled(db, "yesterdays_results"))) {
      return NextResponse.json({ skipped: "Switched off", resultsDate, attempt });
    }
  } catch (settingsError) {
    console.error("cron.yesterdays-results.settings_failed", settingsError);
    return NextResponse.json({ error: "Could not check the automation switch." }, { status: 503 });
  }

  // One send per recipient per results date, whoever sent it. A manual send
  // earlier in the day stands the job down for that address, and a recipient
  // whose delivery failed is retried on the next attempt without re-mailing
  // the ones that already went out.
  const history = await db
    .from("bet_email_sends")
    .select("recipient_email")
    .eq("email_type", "yesterdays_results")
    .eq("context_date", resultsDate);

  if (history.error) {
    console.error("cron.yesterdays-results.history_failed", history.error.message);
    return NextResponse.json({ error: "Could not check send history." }, { status: 503 });
  }

  const delivered = new Set(
    history.data.map((row) => String(row.recipient_email).toLowerCase()),
  );
  const pending = RECIPIENTS.filter((recipient) => !delivered.has(recipient.toLowerCase()));

  if (pending.length === 0) {
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
      to: ALERT_RECIPIENTS,
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
  const subject = yesterdaysResultsSubject(emailParams);
  const html = yesterdaysResultsHtml(emailParams);
  const text = yesterdaysResultsText(emailParams);

  const sent: string[] = [];
  const failed: string[] = [];

  // One email per recipient, each logged as its own batch so the send history
  // shows them as the separate messages they are.
  for (const recipient of pending) {
    const { error: emailError } = await resend.emails.send({
      from: getResendFromEmail(),
      to: [recipient],
      subject,
      html,
      text,
    });

    if (emailError) {
      console.error("cron.yesterdays-results.send_failed", recipient, emailError);
      failed.push(recipient);
      continue;
    }

    sent.push(recipient);

    try {
      await logBetEmailSends({
        emailType: "yesterdays_results",
        recipients: [recipient],
        sentById: null,
        playCount: entries.length,
        contextDate: resultsDate,
        isAutomated: true,
        client: db,
      });
    } catch (logError) {
      // The mail is already out; a logging failure must not look like a send
      // failure. It does mean a later attempt could re-mail this recipient.
      console.error("cron.yesterdays-results.log_failed", recipient, logError);
    }
  }

  if (sent.length === 0) {
    return NextResponse.json({ error: "Could not send email.", failed }, { status: 502 });
  }

  return NextResponse.json({
    sent: true,
    resultsDate,
    attempt,
    recipientCount: sent.length,
    failedCount: failed.length,
    playCount: entries.length,
  });
}
