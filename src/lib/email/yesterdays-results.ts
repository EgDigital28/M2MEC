import { CONFIDENTIALITY_NOTICE } from "@/lib/reports/confidentiality";
import { betCellHtml, betEventLines } from "@/lib/email/bet-cell";
import {
  computeDayResultsStats,
  formatCurrency,
  formatCurrencyWhole,
  formatEventDate,
  formatOdds,
  formatPercent,
  type BetEntryComputed,
} from "@/lib/bets/calculations";
import {
  EMAIL_COLORS,
  emailProfitLossColor,
  emailWinPctColor,
  renderEmailEmptyState,
  renderEmailHtmlCell,
  renderEmailSection,
  renderEmailShell,
  renderEmailStatGridRows,
  renderEmailSubheading,
  renderEmailSummaryLine,
  renderEmailTable,
} from "@/lib/email/layout";

type YesterdaysResultsEmailParams = {
  entries: BetEntryComputed[];
  resultsDate: string;
  /**
   * Plays from earlier days this person was sent as Open, graded since. Only
   * the scheduled email carries these; each person's set is their own.
   */
  carriedOver?: BetEntryComputed[];
};

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function signedCurrency(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatCurrency(Math.abs(value))}`;
}

/** Open plays go out as Open and are owed to the reader until graded. */
function pendingNote(openCount: number) {
  return openCount > 0
    ? `${plural(openCount, "play")} still open. Once graded, ${openCount === 1 ? "it" : "they"} will appear in a later results email.`
    : null;
}

function carriedTable(carried: BetEntryComputed[]) {
  return renderEmailTable(
    [
      { key: "date", label: "Date" },
      { key: "sport", label: "Sport" },
      { key: "bet", label: "Bet" },
      { key: "line", label: "Line", align: "right", mono: true },
      { key: "risk", label: "Risk", align: "right", mono: true },
      { key: "result", label: "Result" },
      { key: "pl", label: "P/L", align: "right", mono: true },
    ],
    carried.map((entry) => ({
      cells: [
        renderEmailHtmlCell(formatEventDate(entry.event_date)),
        renderEmailHtmlCell(entry.sport),
        betCellHtml(entry, entry.event_date),
        renderEmailHtmlCell(formatOdds(entry.line)),
        renderEmailHtmlCell(formatCurrency(entry.risk)),
        renderEmailHtmlCell(entry.status),
        renderEmailHtmlCell(formatCurrency(entry.profit_loss)),
      ],
      cellColors: [undefined, undefined, undefined, undefined, undefined, undefined, emailProfitLossColor(entry.profit_loss)],
    })),
    { compact: true },
  );
}

function carriedSummary(carried: BetEntryComputed[]) {
  const net = carried.reduce((sum, entry) => sum + entry.profit_loss, 0);
  return `${plural(carried.length, "play")} from earlier days · Net ${signedCurrency(net)}`;
}

function formatResultsDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function yesterdaysResultsSubject({
  resultsDate,
}: Pick<YesterdaysResultsEmailParams, "resultsDate">) {
  return `M2MEC — Yesterday's Results (${formatResultsDate(resultsDate)})`;
}

export function yesterdaysResultsHtml({ entries, resultsDate, carriedOver = [] }: YesterdaysResultsEmailParams) {
  const stats = computeDayResultsStats(entries);

  const summary = renderEmailStatGridRows(
    [
      [
        { label: "Plays", value: String(stats.playCount) },
        { label: "Wins", value: String(stats.winCount) },
        { label: "Losses", value: String(stats.lossCount) },
        { label: "Voids", value: String(stats.voidCount) },
      ],
      [
        {
          label: "P/L",
          value: formatCurrencyWhole(stats.totalProfitLoss),
          valueColor: emailProfitLossColor(stats.totalProfitLoss),
        },
        { label: "Win %", value: formatPercent(stats.winPct), valueColor: emailWinPctColor(stats.winPct) },
        {
          label: "ROI",
          value: formatPercent(stats.roi),
          valueColor: emailProfitLossColor(stats.roi ?? 0),
        },
      ],
    ],
    4,
  );

  // No date column: every row is the results date, which the heading gives.
  // The carried-over table keeps its dates, since those differ.
  const resultsTable = entries.length
    ? renderEmailTable(
        [
          { key: "sport", label: "Sport" },
          { key: "bet", label: "Bet" },
          { key: "line", label: "Line", align: "right", mono: true },
          { key: "risk", label: "Risk", align: "right", mono: true },
          { key: "result", label: "Result" },
          { key: "pl", label: "P/L", align: "right", mono: true },
        ],
        entries.map((entry) => ({
          cells: [
            renderEmailHtmlCell(entry.sport),
            betCellHtml(entry, resultsDate),
            renderEmailHtmlCell(formatOdds(entry.line)),
            renderEmailHtmlCell(formatCurrency(entry.risk)),
            renderEmailHtmlCell(entry.status),
            renderEmailHtmlCell(formatCurrency(entry.profit_loss)),
          ],
          cellColors: [undefined, undefined, undefined, undefined, undefined, emailProfitLossColor(entry.profit_loss)],
        })),
        // Rows do not wrap, so the columns sit closer together to fit.
        { compact: true },
      )
    : renderEmailEmptyState("No plays recorded for this date.");

  const pending = pendingNote(stats.openCount);
  const net = carriedOver.reduce((sum, entry) => sum + entry.profit_loss, 0);

  return renderEmailShell(`
    ${renderEmailSection({
      eyebrow: "Sportsbook Hub",
      title: "Yesterday's Results",
      subtitle: `Results for ${formatResultsDate(resultsDate)}.`,
    })}
    ${entries.length ? summary : ""}
    ${resultsTable}
    ${pending ? renderEmailSummaryLine([pending]) : ""}
    ${
      carriedOver.length
        ? `${renderEmailSubheading("Graded since last email", EMAIL_COLORS.accent)}
    ${carriedTable(carriedOver)}
    ${renderEmailSummaryLine([
      `${plural(carriedOver.length, "play")} from earlier days`,
      `Net <strong style="color:${emailProfitLossColor(net)};font-family:ui-monospace,monospace;">${renderEmailHtmlCell(signedCurrency(net))}</strong>`,
    ])}`
        : ""
    }
  `);
}

export function yesterdaysResultsText({ entries, resultsDate, carriedOver = [] }: YesterdaysResultsEmailParams) {
  const stats = computeDayResultsStats(entries);

  const summary = `
Plays: ${stats.playCount}
Wins: ${stats.winCount}
Losses: ${stats.lossCount}
Voids: ${stats.voidCount}
P/L: ${formatCurrencyWhole(stats.totalProfitLoss)}
Win %: ${formatPercent(stats.winPct)}
ROI: ${formatPercent(stats.roi)}
  `.trim();

  // The bet's line, then its game or result lines indented beneath it.
  const textLine = (entry: BetEntryComputed, day: string) =>
    [
      `${formatEventDate(entry.event_date)} | ${entry.sport} | ${entry.event_name} | ${formatOdds(entry.line)} | Risk ${formatCurrency(entry.risk)} | ${entry.status} | P/L ${formatCurrency(entry.profit_loss)}`,
      ...betEventLines(entry, day).map((line) => `  ${line}`),
    ].join("\n");

  const lines = entries.map((entry) => textLine(entry, resultsDate));

  const pending = pendingNote(stats.openCount);
  const carried = carriedOver.length
    ? `\n\nGRADED SINCE LAST EMAIL\n${carriedOver
        .map((entry) => textLine(entry, entry.event_date))
        .join("\n")}\n${carriedSummary(carriedOver)}`
    : "";
  const body = `${
    entries.length ? `${summary}\n\n${lines.join("\n")}` : "No plays recorded for this date."
  }${pending ? `\n\n${pending}` : ""}${carried}`;

  return `
Yesterday's Results

Results for ${formatResultsDate(resultsDate)}.

${body}

— M2MEC

${CONFIDENTIALITY_NOTICE}
  `.trim();
}
