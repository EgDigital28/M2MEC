import {
  computeDayResultsStats,
  computeSportBetStats,
  formatCurrencyWhole,
  formatPercent,
  formatWeekRangeLabel,
  type BetEntryComputed,
  type DayPlPoint,
  type SportBetStats,
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
  renderEmailTable,
} from "@/lib/email/layout";

export type WeekInReviewEmailParams = {
  entries: BetEntryComputed[];
  sports: { id: string; abbreviation: string; sort_order: number }[];
  weekStart: string;
  weekEnd: string;
  series: DayPlPoint[];
  viewLabel: string;
};

function compactMoney(value: number) {
  const sign = value < 0 ? "-" : value > 0 ? "+" : "";
  const magnitude = Math.abs(value);

  return magnitude < 1000
    ? `${sign}$${Math.round(magnitude)}`
    : `${sign}$${(magnitude / 1000).toFixed(1)}K`;
}

function dayLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return `${new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(parsed)} ${day}`;
}

function barPercent(value: number, peak: number) {
  if (peak <= 0 || value === 0) return 0;
  return Math.max(4, Math.round((Math.abs(value) / peak) * 100));
}

/**
 * Nested-table bar: the one technique that survives Outlook, which ignores
 * styled divs with explicit heights.
 */
function renderBar(percent: number, color: string) {
  if (percent <= 0) {
    return `<span style="color:${EMAIL_COLORS.muted};">—</span>`;
  }

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:${percent}%;border-collapse:collapse;">
      <tr><td style="height:8px;background:${color};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td></tr>
    </table>
  `;
}

export function weekInReviewSubject({
  weekStart,
  weekEnd,
}: Pick<WeekInReviewEmailParams, "weekStart" | "weekEnd">) {
  return `M2MEC — Week in Review (${formatWeekRangeLabel(weekStart, weekEnd)})`;
}

export function weekInReviewHtml(params: WeekInReviewEmailParams) {
  const { entries, sports, weekStart, weekEnd, series, viewLabel } = params;
  const stats = computeDayResultsStats(entries);
  const sportRows = computeSportBetStats(entries, sports).filter((row) => row.hasActivity);
  const dayPeak = Math.max(...series.map((point) => Math.abs(point.profitLoss)), 0);
  const sportPeak = Math.max(...sportRows.map((row) => Math.abs(row.totalProfitLoss)), 0);

  const summary = renderEmailStatGridRows(
    [
      [
        {
          label: "Net P/L",
          value: formatCurrencyWhole(stats.totalProfitLoss),
          valueColor: emailProfitLossColor(stats.totalProfitLoss),
        },
        {
          label: "Record",
          value: `${stats.winCount}–${stats.lossCount}–${stats.voidCount}`,
        },
        {
          label: "Win %",
          value: formatPercent(stats.winPct),
          valueColor: emailWinPctColor(stats.winPct),
        },
      ],
      [
        {
          label: "ROI",
          value: formatPercent(stats.roi),
          valueColor: emailProfitLossColor(stats.roi ?? 0),
        },
        { label: "Risked", value: formatCurrencyWhole(stats.totalRisked) },
        { label: "Open", value: String(stats.openCount) },
      ],
    ],
    3,
  );

  const dailyTable = renderEmailTable(
    [
      { key: "day", label: "Day" },
      { key: "pl", label: "P/L", align: "right", mono: true },
      { key: "bar", label: "" },
    ],
    series.map((point) => ({
      cells: [
        renderEmailHtmlCell(dayLabel(point.date)),
        point.playCount === 0 ? "—" : renderEmailHtmlCell(compactMoney(point.profitLoss)),
        renderBar(
          barPercent(point.profitLoss, dayPeak),
          point.profitLoss >= 0 ? EMAIL_COLORS.profit : EMAIL_COLORS.loss,
        ),
      ],
      cellColors: [undefined, emailProfitLossColor(point.profitLoss), undefined],
    })),
  );

  const sportTable = sportRows.length
    ? renderEmailTable(
        [
          { key: "sport", label: "Sport" },
          { key: "record", label: "Record", mono: true },
          { key: "risked", label: "Risked", align: "right", mono: true },
          { key: "pl", label: "P/L", align: "right", mono: true },
          { key: "bar", label: "" },
          { key: "winpct", label: "Win %", align: "right", mono: true },
          { key: "roi", label: "ROI", align: "right", mono: true },
        ],
        sportRows.map((row: SportBetStats) => ({
          cells: [
            renderEmailHtmlCell(row.sport),
            renderEmailHtmlCell(`${row.winCount}–${row.lossCount}–${row.voidCount}`),
            renderEmailHtmlCell(formatCurrencyWhole(row.totalRisked)),
            renderEmailHtmlCell(compactMoney(row.totalProfitLoss)),
            renderBar(
              barPercent(row.totalProfitLoss, sportPeak),
              row.totalProfitLoss >= 0 ? EMAIL_COLORS.profit : EMAIL_COLORS.loss,
            ),
            renderEmailHtmlCell(formatPercent(row.winPct)),
            renderEmailHtmlCell(formatPercent(row.roi)),
          ],
          cellColors: [
            undefined,
            undefined,
            undefined,
            emailProfitLossColor(row.totalProfitLoss),
            undefined,
            emailWinPctColor(row.winPct),
            emailProfitLossColor(row.roi ?? 0),
          ],
        })),
      )
    : renderEmailEmptyState("No plays recorded in this range.");

  return renderEmailShell(`
    ${renderEmailSection({
      eyebrow: "Sportsbook Hub",
      title: "Week in Review",
      subtitle: `${viewLabel} · ${formatWeekRangeLabel(weekStart, weekEnd)} · ${stats.playCount} ${
        stats.playCount === 1 ? "play" : "plays"
      }`,
    })}
    ${summary}
    <p style="margin:24px 0 0;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${EMAIL_COLORS.muted};">Daily P/L</p>
    ${dailyTable}
    <p style="margin:24px 0 0;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${EMAIL_COLORS.muted};">By sport</p>
    ${sportTable}
  `);
}

export function weekInReviewText(params: WeekInReviewEmailParams) {
  const { entries, sports, weekStart, weekEnd, series, viewLabel } = params;
  const stats = computeDayResultsStats(entries);
  const sportRows = computeSportBetStats(entries, sports).filter((row) => row.hasActivity);

  const summary = [
    `Net P/L: ${formatCurrencyWhole(stats.totalProfitLoss)}`,
    `Record: ${stats.winCount}-${stats.lossCount}-${stats.voidCount}`,
    `Win %: ${formatPercent(stats.winPct)}`,
    `ROI: ${formatPercent(stats.roi)}`,
    `Risked: ${formatCurrencyWhole(stats.totalRisked)}`,
    `Open: ${stats.openCount}`,
  ].join("\n");

  const daily = series
    .map((point) => `${dayLabel(point.date)}: ${point.playCount === 0 ? "—" : compactMoney(point.profitLoss)}`)
    .join("\n");

  const bySport = sportRows.length
    ? sportRows
        .map(
          (row) =>
            `${row.sport} | ${row.winCount}-${row.lossCount}-${row.voidCount} | Risked ${formatCurrencyWhole(row.totalRisked)} | P/L ${compactMoney(row.totalProfitLoss)} | Win ${formatPercent(row.winPct)} | ROI ${formatPercent(row.roi)}`,
        )
        .join("\n")
    : "No plays recorded in this range.";

  return `
Week in Review

${viewLabel} · ${formatWeekRangeLabel(weekStart, weekEnd)} · ${stats.playCount} ${stats.playCount === 1 ? "play" : "plays"}

${summary}

Daily P/L
${daily}

By sport
${bySport}

— M2MEC
  `.trim();
}
