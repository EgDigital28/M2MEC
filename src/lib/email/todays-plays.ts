import {
  formatCurrency,
  formatEventDate,
  formatOdds,
  type BetEntryComputed,
} from "@/lib/bets/calculations";
import {
  renderEmailEmptyState,
  renderEmailHtmlCell,
  renderEmailSection,
  renderEmailShell,
  renderEmailSummaryLine,
  renderEmailTable,
} from "@/lib/email/layout";

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

  const table = entries.length
    ? renderEmailTable(
        [
          { key: "date", label: "Date" },
          { key: "sport", label: "Sport" },
          { key: "event", label: "Event" },
          { key: "line", label: "Line", align: "right", mono: true },
          { key: "risk", label: "Risk", align: "right", mono: true },
          { key: "toWin", label: "To Win", align: "right", mono: true },
        ],
        entries.map((entry) => ({
          cells: [
            renderEmailHtmlCell(formatEventDate(entry.event_date)),
            renderEmailHtmlCell(entry.sport),
            renderEmailHtmlCell(entry.event_name),
            renderEmailHtmlCell(formatOdds(entry.line)),
            renderEmailHtmlCell(formatCurrency(entry.risk)),
            renderEmailHtmlCell(formatCurrency(entry.to_win)),
          ],
        })),
      )
    : renderEmailEmptyState("No open plays scheduled for today or upcoming dates.");

  const summary = entries.length
    ? renderEmailSummaryLine([
        `<strong style="color:#e8edf5;">${entries.length}</strong> open ${entries.length === 1 ? "play" : "plays"}`,
        `Total risk <strong style="color:#e8edf5;font-family:ui-monospace,monospace;">${renderEmailHtmlCell(formatCurrency(totalRisk))}</strong>`,
        `Total to win <strong style="color:#e8edf5;font-family:ui-monospace,monospace;">${renderEmailHtmlCell(formatCurrency(totalToWin))}</strong>`,
      ])
    : "";

  return renderEmailShell(`
    ${renderEmailSection({
      eyebrow: "Sportsbook Hub",
      title: "Upcoming Plays",
      subtitle: `Open positions for ${formatSentOnDate(sentOnDate)} and upcoming events.`,
    })}
    ${table}
    ${summary}
  `);
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
Upcoming Plays

Open positions for ${formatSentOnDate(sentOnDate)} and upcoming events.

${body}

— M2MEC
  `.trim();
}
