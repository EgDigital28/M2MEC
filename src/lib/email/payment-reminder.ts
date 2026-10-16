import { formatCurrency } from "@/lib/bets/calculations";
import {
  EMAIL_COLORS,
  renderEmailParagraph,
  renderEmailSection,
  renderEmailShell,
} from "@/lib/email/layout";
import { escapeHtml } from "@/lib/email/utils";
import { CONFIDENTIALITY_NOTICE } from "@/lib/reports/confidentiality";

/** Payments are due by this time on the day the reminder goes out. */
export const PAYMENT_DUE_TIME = "5:00 PM ET";

type PaymentReminderParams = {
  /** "Sam Bennett (I4-SB)" */
  person: string;
  amount: number;
  /** YYYY-MM-DD, Eastern: the day the reminder is sent. */
  dueDate: string;
  attachmentName: string;
};

export function paymentReminderSubject() {
  return "Payment Reminder Due Today";
}

/** "Friday, October 16, 2026" */
function formatDueDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function detailRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:10px 16px;font-size:13px;color:${EMAIL_COLORS.muted};border-top:1px solid ${EMAIL_COLORS.border};white-space:nowrap;">${escapeHtml(label)}</td>
      <td style="padding:10px 16px;font-size:13px;color:${EMAIL_COLORS.foreground};border-top:1px solid ${EMAIL_COLORS.border};font-weight:600;">${value}</td>
    </tr>
  `;
}

export function paymentReminderHtml({ person, amount, dueDate, attachmentName }: PaymentReminderParams) {
  const money = escapeHtml(formatCurrency(amount));
  const when = escapeHtml(formatDueDate(dueDate));

  return renderEmailShell(`
    ${renderEmailSection({ eyebrow: "M2MEC", title: "Payment Reminder", subtitle: person })}
    <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${EMAIL_COLORS.foreground};">
      This is a reminder that a payment of <strong>${money}</strong> is due <strong>today, ${when}</strong>, by <strong>${escapeHtml(PAYMENT_DUE_TIME)}</strong>.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:20px;border:1px solid ${EMAIL_COLORS.border};border-radius:12px;border-collapse:separate;border-spacing:0;background:${EMAIL_COLORS.surfaceElevated};">
      ${detailRow("Amount due", `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${money}</span>`)}
      ${detailRow("Due", `${when}, by ${escapeHtml(PAYMENT_DUE_TIME)}`)}
    </table>
    ${renderEmailParagraph(escapeHtml(`Your current summary is attached (${attachmentName}), with your full position and payment schedule.`))}
    ${renderEmailParagraph("— M2MEC")}
  `);
}

export function paymentReminderText({ person, amount, dueDate, attachmentName }: PaymentReminderParams) {
  return `
Payment Reminder
${person}

This is a reminder that a payment of ${formatCurrency(amount)} is due today, ${formatDueDate(dueDate)}, by ${PAYMENT_DUE_TIME}.

Amount due: ${formatCurrency(amount)}
Due: ${formatDueDate(dueDate)}, by ${PAYMENT_DUE_TIME}

Your current summary is attached (${attachmentName}), with your full position and payment schedule.

— M2MEC

${CONFIDENTIALITY_NOTICE}
  `.trim();
}
