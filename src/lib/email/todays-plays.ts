import { CONFIDENTIALITY_NOTICE } from "@/lib/reports/confidentiality";
import {
  formatCurrency,
  formatEventDate,
  formatOdds,
  type BetEntryComputed,
} from "@/lib/bets/calculations";
import { betCellHtml, betEventLines } from "@/lib/email/bet-cell";
import { todaysPlaysTotals } from "@/lib/bets/todays-plays-split";
import { escapeHtml } from "@/lib/email/utils";
import {
  EMAIL_COLORS,
  emailProfitLossColor,
  renderEmailEmptyState,
  renderEmailHtmlCell,
  renderEmailSection,
  renderEmailShell,
  renderEmailSubheading,
  renderEmailSummaryLine,
  renderEmailTable,
} from "@/lib/email/layout";

/**
 * Today's plays is sent as a first email and then as updates.
 *
 * The first email of the day lists every play. An update puts the plays that
 * arrived since the previous email at the top, highlighted, with everything
 * already sent below it — still-open plays first, graded ones last — so the
 * two sections together always cover every play dated today.
 */
type TodaysPlaysEmailParams = {
  sentOnDate: string;
  isFirst: boolean;
  /** On a first email, every play. On an update, only the new ones. */
  newPlays: BetEntryComputed[];
  /** Plays already sent today. Always empty on a first email. */
  earlierPlays: BetEntryComputed[];
  /** Plays on tomorrow's games. The section is left out when empty. */
  lookahead?: BetEntryComputed[];
};

function nextDay(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/** "2 plays · Risk $35,000.00 · To win $50,185.71" for tomorrow's plays. */
function lookaheadSummary(plays: BetEntryComputed[]) {
  const risk = plays.reduce((sum, entry) => sum + entry.risk, 0);
  const toWin = plays.reduce((sum, entry) => sum + entry.to_win, 0);
  return [plural(plays.length, "play"), `Risk ${formatCurrency(risk)}`, `To win ${formatCurrency(toWin)}`];
}

/** Tomorrow's look ahead: below today's totals, and only when there is any. */
function lookaheadHtml(sentOnDate: string, plays: BetEntryComputed[]) {
  if (plays.length === 0) return "";
  const tomorrow = nextDay(sentOnDate);
  return `
    ${renderEmailSubheading(`Tomorrow's look ahead · ${formatSentOnDate(tomorrow)}`)}
    ${playsTable(plays, tomorrow)}
    ${renderEmailSummaryLine(lookaheadSummary(plays).map((part) => renderEmailHtmlCell(part)))}
  `;
}

function formatSentOnDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Only the first email of the day carries the date. */
export function todaysPlaysSubject({
  sentOnDate,
  isFirst,
  newPlays,
}: Pick<TodaysPlaysEmailParams, "sentOnDate" | "isFirst" | "newPlays">) {
  return isFirst
    ? `M2MEC — Today's Plays (${formatSentOnDate(sentOnDate)})`
    : `M2MEC — Today's Plays - ${newPlays.length} New`;
}

function signedCurrency(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatCurrency(Math.abs(value))}`;
}

/** "Open", "Void", or the outcome with its money, e.g. "Win +$9,090.91". */
function resultLabel(entry: BetEntryComputed) {
  return entry.status === "Win" || entry.status === "Loss"
    ? `${entry.status} ${signedCurrency(entry.profit_loss)}`
    : entry.status;
}

/** "Win +$9,090.91" on one line: rows do not wrap in this email. */
function resultCell(entry: BetEntryComputed) {
  return `<span style="white-space:nowrap;">${escapeHtml(resultLabel(entry))}</span>`;
}

function resultColor(entry: BetEntryComputed) {
  return entry.status === "Win" || entry.status === "Loss"
    ? emailProfitLossColor(entry.profit_loss)
    : EMAIL_COLORS.muted;
}


function playsTable(entries: BetEntryComputed[], day: string, highlight = false) {
  // No date column: every play in this email is today's, and the heading says
  // which day. The room goes to the bet and its game lines.
  return renderEmailTable(
    [
      { key: "sport", label: "Sport" },
      { key: "bet", label: "Bet" },
      { key: "line", label: "Line", align: "right", mono: true },
      { key: "risk", label: "Risk", align: "right", mono: true },
      { key: "toWin", label: "To Win", align: "right", mono: true },
      { key: "result", label: "Result", align: "right", mono: true },
    ],
    entries.map((entry) => ({
      cells: [
        renderEmailHtmlCell(entry.sport),
        betCellHtml(entry, day),
        renderEmailHtmlCell(formatOdds(entry.line)),
        renderEmailHtmlCell(formatCurrency(entry.risk)),
        renderEmailHtmlCell(formatCurrency(entry.to_win)),
        resultCell(entry),
      ],
      cellColors: [undefined, undefined, undefined, undefined, undefined, resultColor(entry)],
    })),
    // Rows never wrap here, so the columns sit closer together to fit.
    { highlight, compact: true },
  );
}

/** Settled today: "1–0 · 1 void · Net +$9,090.91". */
function settledParts(totals: ReturnType<typeof todaysPlaysTotals>) {
  const parts: string[] = [];
  if (totals.wins + totals.losses > 0) parts.push(`${totals.wins}–${totals.losses}`);
  if (totals.voids > 0) parts.push(plural(totals.voids, "void"));
  return parts;
}

/**
 * Two labelled lines: money still riding, and what has already settled today.
 * Either line is left out when it has nothing to say.
 */
function totalsBlock(entries: BetEntryComputed[]) {
  const totals = todaysPlaysTotals(entries);
  const strong = (value: string, color: string = EMAIL_COLORS.foreground, mono = false) =>
    `<strong style="color:${color};${mono ? "font-family:ui-monospace,SFMono-Regular,Menlo,monospace;" : ""}">${renderEmailHtmlCell(value)}</strong>`;
  const dot = ` <span style="color:${EMAIL_COLORS.border};">·</span> `;
  const rows: [string, string][] = [];

  if (totals.openCount > 0) {
    rows.push([
      "Still riding",
      [
        `${strong(String(totals.openCount))} ${totals.openCount === 1 ? "play" : "plays"}`,
        `Risk ${strong(formatCurrency(totals.openRisk), undefined, true)}`,
        `To win ${strong(formatCurrency(totals.openToWin), undefined, true)}`,
      ].join(dot),
    ]);
  }

  if (totals.settledCount > 0) {
    rows.push([
      "Settled today",
      [
        ...settledParts(totals).map((part) => strong(part)),
        `Net ${strong(signedCurrency(totals.settledNet), emailProfitLossColor(totals.settledNet), true)}`,
      ].join(dot),
    ]);
  }

  if (!rows.length) return "";

  const body = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:3px 16px 3px 0;font-size:13px;line-height:1.6;color:${EMAIL_COLORS.muted};white-space:nowrap;vertical-align:top;">${label}</td>
          <td style="padding:3px 0;font-size:13px;line-height:1.6;color:${EMAIL_COLORS.muted};">${value}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:16px;border-collapse:collapse;">
      ${body}
    </table>
  `;
}

export function todaysPlaysHtml({ sentOnDate, isFirst, newPlays, earlierPlays, lookahead = [] }: TodaysPlaysEmailParams) {
  const all = [...newPlays, ...earlierPlays];
  const date = formatSentOnDate(sentOnDate);

  if (isFirst) {
    return renderEmailShell(`
      ${renderEmailSection({
        eyebrow: "Sportsbook Hub",
        title: "Today's Plays",
        subtitle: `Plays for ${date}.`,
      })}
      ${newPlays.length ? playsTable(newPlays, sentOnDate) : renderEmailEmptyState("No plays scheduled for today.")}
      ${totalsBlock(all)}
      ${lookaheadHtml(sentOnDate, lookahead)}
    `);
  }

  return renderEmailShell(`
    ${renderEmailSection({
      eyebrow: "Sportsbook Hub",
      title: "Today's Plays",
      subtitle: `${plural(newPlays.length, "new play")} since the last email · ${date}.`,
    })}
    ${renderEmailSubheading("New since last email", EMAIL_COLORS.accent)}
    ${playsTable(newPlays, sentOnDate, true)}
    ${earlierPlays.length ? `${renderEmailSubheading("Sent earlier today")}${playsTable(earlierPlays, sentOnDate)}` : ""}
    ${totalsBlock(all)}
    ${lookaheadHtml(sentOnDate, lookahead)}
  `);
}

function textLine(entry: BetEntryComputed, day: string) {
  const line = `${formatEventDate(entry.event_date)} | ${entry.sport} | ${entry.event_name} | ${formatOdds(entry.line)} | Risk ${formatCurrency(entry.risk)} | To Win ${formatCurrency(entry.to_win)} | ${resultLabel(entry)}`;
  return [line, ...betEventLines(entry, day).map((event) => `  ${event}`)].join("\n");
}

function textTotals(entries: BetEntryComputed[]) {
  const totals = todaysPlaysTotals(entries);
  const lines: string[] = [];

  if (totals.openCount > 0) {
    lines.push(
      `Still riding: ${plural(totals.openCount, "play")} · Risk ${formatCurrency(totals.openRisk)} · To win ${formatCurrency(totals.openToWin)}`,
    );
  }

  if (totals.settledCount > 0) {
    lines.push(
      `Settled today: ${[...settledParts(totals), `Net ${signedCurrency(totals.settledNet)}`].join(" · ")}`,
    );
  }

  return lines.join("\n");
}

export function todaysPlaysText({ sentOnDate, isFirst, newPlays, earlierPlays, lookahead = [] }: TodaysPlaysEmailParams) {
  const all = [...newPlays, ...earlierPlays];
  const date = formatSentOnDate(sentOnDate);
  const totals = textTotals(all);

  const body = isFirst
    ? `Plays for ${date}.\n\n${newPlays.length ? newPlays.map((entry) => textLine(entry, sentOnDate)).join("\n") : "No plays scheduled for today."}`
    : [
        `${plural(newPlays.length, "new play")} since the last email · ${date}.`,
        `NEW SINCE LAST EMAIL\n${newPlays.map((entry) => textLine(entry, sentOnDate)).join("\n")}`,
        earlierPlays.length ? `SENT EARLIER TODAY\n${earlierPlays.map((entry) => textLine(entry, sentOnDate)).join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

  return `
Today's Plays

${body}${totals ? `\n\n${totals}` : ""}${
    lookahead.length
      ? `\n\nTOMORROW'S LOOK AHEAD · ${formatSentOnDate(nextDay(sentOnDate))}\n${lookahead
          .map((entry) => textLine(entry, nextDay(sentOnDate)))
          .join("\n")}\n${lookaheadSummary(lookahead).join(" · ")}`
      : ""
  }

— M2MEC

${CONFIDENTIALITY_NOTICE}
  `.trim();
}
