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
  emailProfitLossColor,
  emailWinPctColor,
  renderEmailEmptyState,
  renderEmailHtmlCell,
  renderEmailSection,
  renderEmailShell,
  renderEmailStatGridRows,
  renderEmailTable,
} from "@/lib/email/layout";

type YesterdaysResultsEmailParams = {
  entries: BetEntryComputed[];
  resultsDate: string;
};

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

export function yesterdaysResultsHtml({ entries, resultsDate }: YesterdaysResultsEmailParams) {
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

  const resultsTable = entries.length
    ? renderEmailTable(
        [
          { key: "date", label: "Date" },
          { key: "sport", label: "Sport" },
          { key: "event", label: "Event" },
          { key: "line", label: "Line", align: "right", mono: true },
          { key: "risk", label: "Risk", align: "right", mono: true },
          { key: "result", label: "Result" },
          { key: "pl", label: "P/L", align: "right", mono: true },
        ],
        entries.map((entry) => ({
          cells: [
            renderEmailHtmlCell(formatEventDate(entry.event_date)),
            renderEmailHtmlCell(entry.sport),
            renderEmailHtmlCell(entry.event_name),
            renderEmailHtmlCell(formatOdds(entry.line)),
            renderEmailHtmlCell(formatCurrency(entry.risk)),
            renderEmailHtmlCell(entry.status),
            renderEmailHtmlCell(formatCurrency(entry.profit_loss)),
          ],
          cellColors: [
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            emailProfitLossColor(entry.profit_loss),
          ],
        })),
      )
    : renderEmailEmptyState("No plays recorded for this date.");

  return renderEmailShell(`
    ${renderEmailSection({
      eyebrow: "Sportsbook Hub",
      title: "Yesterday's Results",
      subtitle: `Results for ${formatResultsDate(resultsDate)}.`,
    })}
    ${summary}
    ${resultsTable}
  `);
}

export function yesterdaysResultsText({ entries, resultsDate }: YesterdaysResultsEmailParams) {
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

  const lines = entries.map(
    (entry) =>
      `${formatEventDate(entry.event_date)} | ${entry.sport} | ${entry.event_name} | ${formatOdds(entry.line)} | Risk ${formatCurrency(entry.risk)} | ${entry.status} | P/L ${formatCurrency(entry.profit_loss)}`,
  );

  const body = entries.length
    ? `${summary}\n\n${lines.join("\n")}`
    : `${summary}\n\nNo plays recorded for this date.`;

  return `
Yesterday's Results

Results for ${formatResultsDate(resultsDate)}.

${body}

— M2MEC
  `.trim();
}
