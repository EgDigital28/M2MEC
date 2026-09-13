import {
  computeDayResultsStats,
  formatCurrency,
  formatCurrencyWhole,
  formatEventDate,
  formatOdds,
  formatPercent,
  formatWeekRangeLabel,
  type BetEntryComputed,
  type WeekDateRange,
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

type WeeklySummaryEmailParams = {
  entries: BetEntryComputed[];
  weekRange: WeekDateRange;
};

export function weeklySummarySubject({ weekRange }: Pick<WeeklySummaryEmailParams, "weekRange">) {
  return `M2MEC — Weekly Summary (${formatWeekRangeLabel(weekRange.weekStart, weekRange.weekEnd)})`;
}

export function weeklySummaryHtml({ entries, weekRange }: WeeklySummaryEmailParams) {
  const stats = computeDayResultsStats(entries);
  const rangeLabel = formatWeekRangeLabel(weekRange.weekStart, weekRange.weekEnd);

  const summary = renderEmailStatGridRows(
    [
      [
        { label: "Plays", value: String(stats.playCount) },
        { label: "Wins", value: String(stats.winCount) },
        { label: "Losses", value: String(stats.lossCount) },
        { label: "Open", value: String(stats.openCount) },
      ],
      [
        {
          label: "P/L",
          value: formatCurrencyWhole(stats.totalProfitLoss),
          valueColor: emailProfitLossColor(stats.totalProfitLoss),
        },
        {
          label: "Win %",
          value: formatPercent(stats.winPct),
          valueColor: emailWinPctColor(stats.winPct),
        },
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
    : renderEmailEmptyState("No plays recorded for this week.");

  return renderEmailShell(`
    ${renderEmailSection({
      eyebrow: "Sportsbook Hub",
      title: "Weekly Summary",
      subtitle: `All plays from ${rangeLabel} (Mon–Sun).`,
    })}
    ${summary}
    ${resultsTable}
  `);
}

export function weeklySummaryText({ entries, weekRange }: WeeklySummaryEmailParams) {
  const stats = computeDayResultsStats(entries);
  const rangeLabel = formatWeekRangeLabel(weekRange.weekStart, weekRange.weekEnd);

  const summary = `
Plays: ${stats.playCount}
Wins: ${stats.winCount}
Losses: ${stats.lossCount}
Open: ${stats.openCount}
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
    : `${summary}\n\nNo plays recorded for this week.`;

  return `
Weekly Summary

All plays from ${rangeLabel} (Mon–Sun).

${body}

— M2MEC
  `.trim();
}
