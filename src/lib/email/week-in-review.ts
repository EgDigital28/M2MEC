import { CONFIDENTIALITY_NOTICE } from "@/lib/reports/confidentiality";
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

/** Height of each half of the daily chart, above and below the zero line. */
const CHART_HALF_PX = 72;

function barHeight(value: number, peak: number) {
  if (peak <= 0 || value === 0) return 0;
  // A thin sliver for small days, so a day with plays never looks empty.
  return Math.max(3, Math.round((Math.abs(value) / peak) * CHART_HALF_PX));
}

/** One fixed-height table row: a bar segment when coloured, a spacer if not. */
function chartRow(height: number, color?: string) {
  if (height <= 0) return "";
  const fill = color
    ? `<table role="presentation" align="center" cellspacing="0" cellpadding="0" style="width:62%;border-collapse:collapse;"><tr><td style="height:${height}px;background:${color};font-size:0;line-height:0;">&nbsp;</td></tr></table>`
    : "&nbsp;";
  return `<tr><td style="height:${height}px;font-size:0;line-height:0;padding:0;">${fill}</td></tr>`;
}

/**
 * The daily P/L as columns either side of a zero line, matching the Weekly
 * page. Built from fixed-height table rows rather than styled divs, because
 * Outlook ignores heights on divs and would collapse every bar.
 */
function renderDailyChart(series: DayPlPoint[], peak: number) {
  const width = `${(100 / Math.max(series.length, 1)).toFixed(2)}%`;

  const columns = series
    .map((point) => {
      const height = barHeight(point.profitLoss, peak);
      const up = point.profitLoss > 0 ? height : 0;
      const down = point.profitLoss < 0 ? height : 0;
      const amount =
        point.playCount === 0
          ? `<span style="color:${EMAIL_COLORS.muted};">—</span>`
          : // On a phone a column is ~38px wide, too narrow for "-$170.0K" on
            // one line, so it may break after the dollar sign instead of
            // running into the next day. On a desktop screen it never wraps.
            renderEmailHtmlCell(compactMoney(point.profitLoss)).replace("$", "$<wbr>");

      return `
        <td valign="top" style="width:${width};padding:0 1px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            ${chartRow(CHART_HALF_PX - up)}
            ${chartRow(up, EMAIL_COLORS.profit)}
            <tr><td style="height:1px;background:${EMAIL_COLORS.border};font-size:0;line-height:0;padding:0;">&nbsp;</td></tr>
            ${chartRow(down, EMAIL_COLORS.loss)}
            ${chartRow(CHART_HALF_PX - down)}
            <tr><td align="center" style="padding:10px 0 0;font-size:12px;line-height:1.3;color:${EMAIL_COLORS.muted};">${renderEmailHtmlCell(dayLabel(point.date))}</td></tr>
            <tr><td align="center" style="padding:2px 0 0;font-size:11px;line-height:1.3;font-weight:600;color:${emailProfitLossColor(point.profitLoss)};">${amount}</td></tr>
          </table>
        </td>
      `;
    })
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;border:1px solid ${EMAIL_COLORS.border};border-radius:12px;border-collapse:separate;background:${EMAIL_COLORS.surfaceElevated};">
      <tr><td style="padding:20px 12px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;table-layout:fixed;">
          <tr>${columns}</tr>
        </table>
      </td></tr>
    </table>
  `;
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

  const dailyChart = renderDailyChart(series, dayPeak);

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
    ${dailyChart}
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

${CONFIDENTIALITY_NOTICE}
  `.trim();
}
