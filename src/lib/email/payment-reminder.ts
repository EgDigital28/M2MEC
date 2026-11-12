import { formatCurrency } from "@/lib/bets/calculations";
import {
  EMAIL_COLORS,
  renderEmailParagraph,
  renderEmailSection,
  renderEmailShell,
} from "@/lib/email/layout";
import { escapeHtml } from "@/lib/email/utils";
import { CONFIDENTIALITY_NOTICE } from "@/lib/reports/confidentiality";

/** Payments are due by this time on the due date. */
export const PAYMENT_DUE_TIME = "5:00 PM ET";

type PaymentReminderParams = {
  /** "Sam Bennett (I4-SB)" */
  person: string;
  amount: number;
  /** YYYY-MM-DD, Eastern: the day the payment is due, chosen at send time. */
  dueDate: string;
  /** YYYY-MM-DD, Eastern: the day the reminder is sent. */
  today: string;
  attachmentName: string;
};

/** "Payment Reminder Due Today", or "Payment Reminder Due Friday, November 13" for a later date. */
export function paymentReminderSubject({ dueDate, today }: Pick<PaymentReminderParams, "dueDate" | "today">) {
  return dueDate === today ? "Payment Reminder Due Today" : `Payment Reminder Due ${formatDueDate(dueDate, false)}`;
}

/** "Friday, October 16, 2026" */
function formatDueDate(date: string, withYear = true) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(withYear ? { year: "numeric" as const } : {}),
  }).format(new Date(year, month - 1, day));
}

/** "today, Thursday, November 12, 2026" on the day itself, otherwise just the date. */
function dueWhen({ dueDate, today }: Pick<PaymentReminderParams, "dueDate" | "today">) {
  return dueDate === today ? `today, ${formatDueDate(dueDate)}` : formatDueDate(dueDate);
}

function detailRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:10px 16px;font-size:13px;color:${EMAIL_COLORS.muted};border-top:1px solid ${EMAIL_COLORS.border};white-space:nowrap;">${escapeHtml(label)}</td>
      <td style="padding:10px 16px;font-size:13px;color:${EMAIL_COLORS.foreground};border-top:1px solid ${EMAIL_COLORS.border};font-weight:600;">${value}</td>
    </tr>
  `;
}

export function paymentReminderHtml({ person, amount, dueDate, today, attachmentName }: PaymentReminderParams) {
  const money = escapeHtml(formatCurrency(amount));
  const when = escapeHtml(formatDueDate(dueDate));

  return renderEmailShell(`
    ${renderEmailSection({ eyebrow: "M2MEC", title: "Payment Reminder", subtitle: person })}
    <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${EMAIL_COLORS.foreground};">
      This is a reminder that a payment of <strong>${money}</strong> is due <strong>${escapeHtml(dueWhen({ dueDate, today }))}</strong>, by <strong>${escapeHtml(PAYMENT_DUE_TIME)}</strong>.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:20px;border:1px solid ${EMAIL_COLORS.border};border-radius:12px;border-collapse:separate;border-spacing:0;background:${EMAIL_COLORS.surfaceElevated};">
      ${detailRow("Amount due", `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${money}</span>`)}
      ${detailRow("Due", `${when}, by ${escapeHtml(PAYMENT_DUE_TIME)}`)}
    </table>
    ${renderEmailParagraph(escapeHtml(`Your current summary is attached (${attachmentName}), with your full position and payment schedule.`))}
    ${renderEmailParagraph("— M2MEC")}
  `);
}

export function paymentReminderText({ person, amount, dueDate, today, attachmentName }: PaymentReminderParams) {
  return `
Payment Reminder
${person}

This is a reminder that a payment of ${formatCurrency(amount)} is due ${dueWhen({ dueDate, today })}, by ${PAYMENT_DUE_TIME}.

Amount due: ${formatCurrency(amount)}
Due: ${formatDueDate(dueDate)}, by ${PAYMENT_DUE_TIME}

Your current summary is attached (${attachmentName}), with your full position and payment schedule.

— M2MEC

${CONFIDENTIALITY_NOTICE}
  `.trim();
}
