import {
  formatCurrency,
  formatEventDate,
  formatOdds,
  type BetEntryComputed,
} from "@/lib/bets/calculations";
import {
  renderEmailHtmlCell,
  renderEmailSection,
  renderEmailShell,
  renderEmailSummaryLine,
  renderEmailTable,
} from "@/lib/email/layout";

type UngradedAlertEmailParams = {
  ungraded: BetEntryComputed[];
  playCount: number;
  resultsDate: string;
  attempts: number;
};

function formatResultsDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function summarySentence({ ungraded, playCount, attempts }: UngradedAlertEmailParams) {
  return `${ungraded.length} of ${playCount} ${playCount === 1 ? "play" : "plays"} still ungraded after ${attempts} ${attempts === 1 ? "check" : "checks"}.`;
}

export function ungradedAlertSubject({
  resultsDate,
}: Pick<UngradedAlertEmailParams, "resultsDate">) {
  return `M2MEC — Results Email Skipped (${formatResultsDate(resultsDate)})`;
}

export function ungradedAlertHtml(params: UngradedAlertEmailParams) {
  const { ungraded, resultsDate } = params;

  const table = renderEmailTable(
    [
      { key: "sport", label: "Sport" },
      { key: "event", label: "Event" },
      { key: "line", label: "Line", align: "right", mono: true },
      { key: "risk", label: "Risk", align: "right", mono: true },
      { key: "status", label: "Status" },
    ],
    ungraded.map((entry) => ({
      cells: [
        renderEmailHtmlCell(entry.sport),
        renderEmailHtmlCell(entry.event_name),
        renderEmailHtmlCell(formatOdds(entry.line)),
        renderEmailHtmlCell(formatCurrency(entry.risk)),
        renderEmailHtmlCell(entry.status),
      ],
    })),
  );

  return renderEmailShell(`
    ${renderEmailSection({
      eyebrow: "Sportsbook Hub",
      title: "Results Email Skipped",
      subtitle: `The ${formatResultsDate(resultsDate)} results email was not sent because grading is incomplete.`,
    })}
    ${renderEmailSummaryLine([summarySentence(params), `Event date ${formatEventDate(resultsDate)}`])}
    ${table}
  `);
}

export function ungradedAlertText(params: UngradedAlertEmailParams) {
  const { ungraded, resultsDate } = params;

  const lines = ungraded.map(
    (entry) =>
      `${entry.sport} | ${entry.event_name} | ${formatOdds(entry.line)} | Risk ${formatCurrency(entry.risk)} | ${entry.status}`,
  );

  return `
Results Email Skipped

The ${formatResultsDate(resultsDate)} results email was not sent because grading is incomplete.

${summarySentence(params)}

${lines.join("\n")}

— M2MEC
  `.trim();
}
