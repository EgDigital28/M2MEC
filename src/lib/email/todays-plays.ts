import {
  formatCurrency,
  formatEventDate,
  formatOdds,
  type BetEntryComputed,
} from "@/lib/bets/calculations";
import { escapeHtml } from "@/lib/email/utils";

type TodaysPlaysEmailParams = {
  entries: BetEntryComputed[];
  sentOnDate: string;
};

function formatSentOnDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function todaysPlaysSubject({ sentOnDate }: Pick<TodaysPlaysEmailParams, "sentOnDate">) {
  return `M2MEC — Upcoming Plays (${formatSentOnDate(sentOnDate)})`;
}

export function todaysPlaysHtml({ entries, sentOnDate }: TodaysPlaysEmailParams) {
  const totalRisk = entries.reduce((sum, entry) => sum + entry.risk, 0);
  const totalToWin = entries.reduce((sum, entry) => sum + entry.to_win, 0);

  const rows = entries
    .map(
      (entry) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(formatEventDate(entry.event_date))}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(entry.sport)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(entry.event_name)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${escapeHtml(formatOdds(entry.line))}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${escapeHtml(formatCurrency(entry.risk))}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${escapeHtml(formatCurrency(entry.to_win))}</td>
        </tr>
      `,
    )
    .join("");

  const emptyState = `
    <p style="margin:16px 0 0;color:#6b7280;">No open plays scheduled for today or upcoming dates.</p>
  `;

  const table = entries.length
    ? `
      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
        <thead>
          <tr style="background:#f3f4f6;text-align:left;">
            <th style="padding:8px 12px;border-bottom:1px solid #d1d5db;">Date</th>
            <th style="padding:8px 12px;border-bottom:1px solid #d1d5db;">Sport</th>
            <th style="padding:8px 12px;border-bottom:1px solid #d1d5db;">Event</th>
            <th style="padding:8px 12px;border-bottom:1px solid #d1d5db;text-align:right;">Line</th>
            <th style="padding:8px 12px;border-bottom:1px solid #d1d5db;text-align:right;">Risk</th>
            <th style="padding:8px 12px;border-bottom:1px solid #d1d5db;text-align:right;">To Win</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p style="margin:16px 0 0;font-size:14px;">
        <strong>${entries.length}</strong> open ${entries.length === 1 ? "play" : "plays"} ·
        Total risk ${escapeHtml(formatCurrency(totalRisk))} ·
        Total to win ${escapeHtml(formatCurrency(totalToWin))}
      </p>
    `
    : emptyState;

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5;max-width:720px;">
      <h1 style="margin:0 0 8px;font-size:20px;">Today's Plays</h1>
      <p style="margin:0;color:#6b7280;font-size:14px;">
        Open positions for ${escapeHtml(formatSentOnDate(sentOnDate))} and upcoming events.
      </p>
      ${table}
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
        Sent from M2MEC · noreply@m2mec.com
      </p>
    </div>
  `.trim();
}

export function todaysPlaysText({ entries, sentOnDate }: TodaysPlaysEmailParams) {
  const totalRisk = entries.reduce((sum, entry) => sum + entry.risk, 0);
  const totalToWin = entries.reduce((sum, entry) => sum + entry.to_win, 0);

  const lines = entries.map(
    (entry) =>
      `${formatEventDate(entry.event_date)} | ${entry.sport} | ${entry.event_name} | ${formatOdds(entry.line)} | Risk ${formatCurrency(entry.risk)} | To Win ${formatCurrency(entry.to_win)}`,
  );

  const body = entries.length
    ? `${lines.join("\n")}\n\n${entries.length} open plays · Total risk ${formatCurrency(totalRisk)} · Total to win ${formatCurrency(totalToWin)}`
    : "No open plays scheduled for today or upcoming dates.";

  return `
Today's Plays

Open positions for ${formatSentOnDate(sentOnDate)} and upcoming events.

${body}

— M2MEC
  `.trim();
}
