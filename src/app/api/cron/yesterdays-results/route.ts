import { NextResponse } from "next/server";
import {
  getYesterdayDateString,
  withComputedFields,
  type BetEntryComputed,
  type BetEntryRow,
} from "@/lib/bets/calculations";
import { logBetEmailSends } from "@/lib/bets/email-sends";
import { loadCarryOvers, recordResultReports } from "@/lib/bets/result-reports";
import { easternHour, isAuthorizedCron } from "@/lib/cron";
import { AUTOMATED_RECIPIENTS, isAutomationEnabled } from "@/lib/email/automation";
import { getResendClient, getResendFromEmail } from "@/lib/email/utils";
import {
  yesterdaysResultsHtml,
  yesterdaysResultsSubject,
  yesterdaysResultsText,
} from "@/lib/email/yesterdays-results";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RECIPIENTS = AUTOMATED_RECIPIENTS;

/**
 * Attempt hours in Eastern time. Vercel schedules in UTC, so the cron fires
 * across a wider UTC window and this gate selects exactly three runs a day in
 * both EST and EDT.
 */
const ATTEMPT_HOURS_ET = [1, 2, 3];

/**
 * Sends yesterday's results to each recipient, once.
 *
 * While any of yesterday's plays is ungraded it waits for the next attempt.
 * The last attempt sends regardless, with ungraded plays shown as Open. What
 * each person was told is recorded, so a play they saw as Open comes back in
 * their next results email, under "Graded since last email", once graded.
 */
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
  const openCount = entries.filter((entry) => entry.status === "Open").length;

  // Hold for grading until the final attempt; then send what there is.
  if (openCount > 0 && !finalAttempt) {
    return NextResponse.json({ skipped: "Ungraded plays", resultsDate, attempt, openCount });
  }

  const carried = new Map<string, BetEntryComputed[]>();

  try {
    for (const recipient of pending) {
      carried.set(recipient, await loadCarryOvers(db, recipient, resultsDate));
    }
  } catch (carryError) {
    console.error("cron.yesterdays-results.carryover_failed", carryError);
    return NextResponse.json({ error: "Could not load carried-over plays." }, { status: 503 });
  }

  // Nobody is sent an empty email: a recipient needs yesterday's plays or
  // something carried over.
  const due = pending.filter((recipient) => entries.length > 0 || (carried.get(recipient) ?? []).length > 0);

  if (due.length === 0) {
    return NextResponse.json({ skipped: "No plays", resultsDate, attempt });
  }

  const resend = getResendClient();

  if (!resend) {
    console.error("cron.yesterdays-results.resend_unconfigured");
    return NextResponse.json({ error: "Email service is not configured." }, { status: 503 });
  }

  const sent: string[] = [];
  const failed: string[] = [];

  // One email per recipient, each logged as its own batch so the send history
  // shows them as the separate messages they are.
  for (const recipient of due) {
    const carriedOver = carried.get(recipient) ?? [];
    const emailParams = { entries, resultsDate, carriedOver };

    const { error: emailError } = await resend.emails.send({
      from: getResendFromEmail(),
      to: [recipient],
      subject: yesterdaysResultsSubject(emailParams),
      html: yesterdaysResultsHtml(emailParams),
      text: yesterdaysResultsText(emailParams),
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

    try {
      await recordResultReports(db, [recipient], resultsDate, [...entries, ...carriedOver]);
    } catch (reportError) {
      // Without this record an Open play would not be carried over later, and
      // a carried one could be carried again.
      console.error("cron.yesterdays-results.report_failed", recipient, reportError);
    }
  }

  if (sent.length === 0) {
    return NextResponse.json({ error: "Could not send email.", failed }, { status: 502 });
  }

  return NextResponse.json({
    sent,
    failed,
    resultsDate,
    attempt,
    openCount,
    playCount: entries.length,
  });
}
