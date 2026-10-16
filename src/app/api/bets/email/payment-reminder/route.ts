import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { getTodayDateString } from "@/lib/bets/calculations";
import { logBetEmailSends } from "@/lib/bets/email-sends";
import {
  paymentReminderHtml,
  paymentReminderSubject,
  paymentReminderText,
} from "@/lib/email/payment-reminder";
import { getResendClient, getResendFromEmail, parseEmailRecipients } from "@/lib/email/utils";
import { buildIndividualPdf } from "@/lib/reports/individual-pdf-file";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Whose report a payment reminder carries. One person for now; widening this
 * means choosing who from the button, not changing how the email is built.
 */
const REMINDER_REPORT_ALIAS = "I4-SB";

/**
 * Sends a payment reminder: the amount due today by 5pm ET, with the person's
 * current summary built fresh and attached as a PDF.
 */
export async function POST(request: Request) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  let body: { to?: string; amount?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  let recipients: string[];

  try {
    recipients = parseEmailRecipients(body.to ?? "");
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid recipients." }, { status: 400 });
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: "At least one recipient is required." }, { status: 400 });
  }

  const amount = typeof body.amount === "number" ? Math.round(body.amount * 100) / 100 : Number.NaN;

  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
    return NextResponse.json({ error: "Enter the amount due." }, { status: 400 });
  }

  const resend = getResendClient();

  if (!resend) {
    console.error("RESEND_API_KEY is not configured");
    return NextResponse.json({ error: "Email service is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: person, error: personError } = await supabase
    .from("profiles")
    .select("id")
    .eq("report_alias", REMINDER_REPORT_ALIAS)
    .maybeSingle();

  if (personError || !person) {
    console.error("payment-reminder.person_lookup_failed", personError?.message);
    return NextResponse.json({ error: `Could not find ${REMINDER_REPORT_ALIAS}.` }, { status: 404 });
  }

  let pdf;

  try {
    pdf = await buildIndividualPdf(person.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF rendering failed.";
    console.error("payment-reminder.render_failed", message);
    return NextResponse.json({ error: `Could not build the summary PDF: ${message}` }, { status: 500 });
  }

  if (!pdf) {
    return NextResponse.json({ error: `Could not find ${REMINDER_REPORT_ALIAS}.` }, { status: 404 });
  }

  const dueDate = getTodayDateString();
  const params = {
    person: pdf.alias ? `${pdf.name} (${pdf.alias})` : pdf.name,
    amount,
    dueDate,
    attachmentName: pdf.fileName,
  };

  const { error: emailError } = await resend.emails.send({
    from: getResendFromEmail(),
    to: recipients,
    subject: paymentReminderSubject(),
    html: paymentReminderHtml(params),
    text: paymentReminderText(params),
    attachments: [{ filename: pdf.fileName, content: pdf.buffer }],
  });

  if (emailError) {
    console.error("payment-reminder.send_failed", emailError);
    return NextResponse.json({ error: "Could not send email." }, { status: 502 });
  }

  try {
    await logBetEmailSends({
      emailType: "payment_reminder",
      recipients,
      sentById: auth.profile.id,
      playCount: 0,
      contextDate: dueDate,
    });
  } catch (logError) {
    console.error("payment-reminder.log_failed", logError);
  }

  return NextResponse.json({ ok: true, recipientCount: recipients.length, amount, attachment: pdf.fileName });
}
