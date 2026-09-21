import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { formatCurrencyWhole } from "@/lib/bets/calculations";
import {
  DEPOSIT_KIND_LABELS,
  depositMethodLabel,
  formatDepositDate,
} from "@/lib/financials/deposits";
import { formatPct } from "@/lib/financials/fin-summary";
import { formatReconciliationDate } from "@/lib/financials/reconciliations";
import { reportFileName } from "@/lib/reports/file-name";
import { describePaymentSchedule } from "@/lib/reports/payment-schedule";
import { IndividualPdf, type IndividualPdfData, type IndividualPdfSection, type Tone } from "@/lib/reports/individual-pdf";
import { loadIndividualReport } from "@/lib/reports/individual-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const tone = (value: number): Tone =>
  value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
const signed = (value: number) =>
  `${value > 0 ? "+" : ""}${formatCurrencyWhole(value)}`;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  const { id } = await params;
  const report = await loadIndividualReport(id);

  if (!report) {
    return NextResponse.json({ error: "Person not found." }, { status: 404 });
  }

  const { fin, person, name, investor, member, depletion } = report;
  const sections: IndividualPdfSection[] = [];

  if (investor) {
    sections.push({
      kind: "stats",
      title: "Equity",
      stats: [
        { label: "IO Allocation", value: formatPct(investor.allocation) },
        { label: "IO Cash Value", value: formatCurrencyWhole(investor.cashValue) },
        { label: "Deposited", value: formatCurrencyWhole(investor.deposit) },
        { label: "Deposit %", value: formatPct(investor.depositPct) },
        {
          label: "Amount Due",
          value: formatCurrencyWhole(investor.amountDue),
          tone: investor.amountDue > 0 ? "warning" : "positive",
        },
      ],
    });
  }

  if (member) {
    sections.push({
      kind: "stats",
      title: "Betting pool",
      stats: [
        { label: "Capital deposited", value: formatCurrencyWhole(member.contributed) },
        { label: "Ownership", value: formatPct(member.currentPct) },
        { label: "Value", value: formatCurrencyWhole(member.value) },
        { label: "ROI", value: signed(member.roiAmount), tone: tone(member.roiAmount) },
      ],
      note:
        member.addedDeposits > 0
          ? `Includes ${formatCurrencyWhole(member.addedDeposits)} added after inception, which is locked out of gains earned before it landed.`
          : undefined,
    });

    sections.push({
      kind: "stats",
      title: "Expense share and forecast",
      stats: [
        {
          label: `${fin.expenses.currentYear} contribution`,
          value: formatCurrencyWhole(member.ytdContribution),
        },
        { label: "YTD P/L", value: formatCurrencyWhole(member.ytdPl), tone: tone(member.ytdPl) },
        { label: "Rest of year spend", value: formatCurrencyWhole(member.remainingSpend) },
        {
          label: "Rest of year P/L",
          value: formatCurrencyWhole(member.remainingPl),
          tone: tone(member.remainingPl),
        },
      ],
    });
  }

  if (depletion) {
    sections.push({
      kind: "stats",
      title: "Capital depletion",
      stats: [
        { label: "Deposits", value: formatCurrencyWhole(depletion.deposits) },
        {
          label: `${fin.expenses.currentYear} end cash`,
          value: formatCurrencyWhole(depletion.endOfYearCash),
          tone: depletion.endOfYearCash < 0 ? "negative" : "neutral",
        },
        {
          label: `${fin.nextYear} forecast`,
          value: formatCurrencyWhole(depletion.nextYear),
          tone: tone(depletion.nextYear),
        },
        {
          label: `${fin.nextYear} end cash`,
          value: formatCurrencyWhole(depletion.endOfNextYearCash),
          tone: depletion.endOfNextYearCash < 0 ? "negative" : "neutral",
        },
      ],
      note: "Depletion draws on deposits, not allocation value.",
    });
  }

  if (report.deposits.length > 0) {
    sections.push({
      kind: "table",
      title: "Deposits",
      columns: [
        { label: "Type" },
        { label: "Date" },
        { label: "Method" },
        { label: "Amount", align: "right" },
        { label: "Description" },
      ],
      rows: report.deposits.map((row) => ({
        cells: [
          DEPOSIT_KIND_LABELS[row.kind],
          formatDepositDate(row.deposited_on),
          depositMethodLabel(row.method),
          formatCurrencyWhole(Number(row.amount)),
          row.description ?? "—",
        ],
      })),
    });
  }

  // Omitted when empty, matching the on-screen report.
  if (report.reconciliations.length > 0) {
    sections.push({
      kind: "table",
      title: "Betting reconciliation",
      columns: [
        { label: "Date" },
        { label: "Amount", align: "right" },
        { label: "Description" },
      ],
      rows: report.reconciliations.map((row) => ({
        cells: [
          formatReconciliationDate(row.paid_on),
          signed(Number(row.amount)),
          row.description,
        ],
        tones: [undefined, tone(Number(row.amount)), undefined],
      })),
      note: `Net ${signed(report.reconciliationNet)}.`,
    });
  }

  const notes = [
    `The ${fin.nextYear} bill is met by the betting pool first; whatever it cannot cover is a company obligation split by equity allocation. This is capital deposited, less this person's share of that remainder, plus anything deposited outside either pool.${
      member
        ? ""
        : " Taking no part in the betting pool does not remove the obligation — it is driven by company holdings, so a share is still carried here."
    }`,
  ];

  if (report.netPosition < 0) {
    notes.push(
      `${formatCurrencyWhole(-report.netPosition)} due by 31 December ${fin.expenses.currentYear} to bring this to zero. ${describePaymentSchedule(report.paymentSchedule)}`,
    );
  }

  if (investor && investor.amountDue > 0) {
    notes.push(
      `${formatCurrencyWhole(investor.amountDue)} of the allocation is still unfunded. Paying it in full would move this to ${signed(report.netPosition + investor.amountDue)}.`,
    );
  }

  const generatedOn = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "America/New_York",
  }).format(new Date());

  const data: IndividualPdfData = {
    // Name and report id only — the email and tier add nothing to a financial
    // statement and cost a line.
    name: person.report_alias ? `${name} (${person.report_alias})` : name,
    subtitle: person.excluded_from_betting ? "Outside the betting pool" : "",
    generatedOn,
    headline: {
      label: "Net position",
      value: signed(report.netPosition),
      tone: tone(report.netPosition),
    },
    headlineStats: [
      { label: "Capital deposited", value: formatCurrencyWhole(report.capitalDeposited) },
      {
        label: `${fin.nextYear} forecast P/L`,
        value: signed(report.forecastPl),
        tone: tone(report.forecastPl),
      },
      { label: "Ancillary deposits", value: formatCurrencyWhole(report.ancillaryTotal) },
    ],
    headlineNotes: notes,
    sections,
  };

  let buffer: Buffer;

  try {
    buffer = await renderToBuffer(IndividualPdf({ data }));
  } catch (error) {
    // A render failure used to return an empty body, which looked like a blank
    // page rather than an error. Say what happened.
    const message = error instanceof Error ? error.message : "PDF rendering failed.";
    console.error("reports.individual.render_failed", message);
    return NextResponse.json({ error: `Could not render the PDF: ${message}` }, { status: 500 });
  }

  const fileName = `${reportFileName(name)}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
