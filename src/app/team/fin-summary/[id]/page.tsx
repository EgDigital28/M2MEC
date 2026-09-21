import { notFound, redirect } from "next/navigation";
import { PrintReportButton } from "@/components/PrintReportButton";
import { reportFileName } from "@/lib/reports/file-name";
import { getCurrentProfile } from "@/lib/auth/profile";
import { formatCurrencyWhole } from "@/lib/bets/calculations";
import { formatPct } from "@/lib/financials/fin-summary";
import { loadFinSummary } from "@/lib/financials/fin-summary-data";
import {
  DEPOSIT_KIND_LABELS,
  formatDepositDate,
  type DepositKind,
} from "@/lib/financials/deposits";
import { formatReconciliationDate } from "@/lib/financials/reconciliations";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function plClass(value: number) {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-muted";
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-2 text-xl font-semibold tabular-nums ${className}`}>{value}</p>
    </div>
  );
}

const th = "px-3 py-2 text-left text-xs font-medium text-muted";
const thr = "px-3 py-2 text-right text-xs font-medium text-muted";
const td = "px-3 py-2";
const tdr = "px-3 py-2 text-right tabular-nums";

export default async function IndividualSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getCurrentProfile();

  if (viewer?.tier !== "admin") {
    redirect("/team");
  }

  const { id } = await params;
  const supabase = await createClient();

  const [fin, personResult, depositResult, reconciliationResult] = await Promise.all([
    loadFinSummary(),
    supabase
      .from("profiles")
      .select("id, email, display_name, report_alias, tier, excluded_from_betting")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("capital_deposits")
      .select("id, kind, deposited_on, amount, description")
      .eq("profile_id", id)
      .order("deposited_on", { ascending: false }),
    supabase
      .from("betting_reconciliations")
      .select("id, paid_on, amount, description")
      .eq("profile_id", id)
      .order("paid_on", { ascending: false }),
  ]);

  const person = personResult.data as {
    id: string;
    email: string | null;
    display_name: string | null;
    report_alias: string | null;
    tier: string;
    excluded_from_betting: boolean | null;
  } | null;

  if (!person) {
    notFound();
  }

  const name = person.display_name ?? person.report_alias ?? person.email ?? "Unknown";
  const investor = fin.investors.find((row) => row.profileId === id);
  const member = fin.members.find((row) => row.profileId === id);
  const depletion = fin.depletion.find((row) => row.profileId === id);

  const deposits = (depositResult.data ?? []) as {
    id: string;
    kind: DepositKind;
    deposited_on: string;
    amount: number;
    description: string | null;
  }[];

  const reconciliations = (reconciliationResult.data ?? []) as {
    id: string;
    paid_on: string;
    amount: number;
    description: string;
  }[];

  const reconciliationNet = reconciliations.reduce((sum, row) => sum + Number(row.amount), 0);
  const depositTotal = (kind: DepositKind) =>
    deposits
      .filter((row) => row.kind === kind)
      .reduce((sum, row) => sum + Number(row.amount), 0);

  // The headline figure: capital actually paid in, less what the betting
  // forecast is expected to consume, plus anything deposited outside either
  // pool. Someone who has funded their allocation in full can finish net
  // positive even while the pool forecasts a loss.
  const ancillaryTotal = depositTotal("ancillary");
  const capitalDeposited = investor?.deposit ?? 0;
  const forecastPl = investor ? (fin.shortfallByInvestor.get(investor.key) ?? 0) : 0;
  const netPosition = capitalDeposited + forecastPl + ancillaryTotal;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            Individual summary
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{name}</h1>
          <p className="mt-2 text-sm text-muted">
            {person.report_alias ? `${person.report_alias} · ` : ""}
            {person.email} · {person.tier}
            {person.excluded_from_betting ? " · outside the betting pool" : ""}
          </p>
          {/* Only meaningful once printed, where the tab chrome is gone. */}
          <p className="hidden text-xs text-muted print:mt-2 print:block">
            M2MEC · generated{" "}
            {new Intl.DateTimeFormat("en-US", {
              dateStyle: "long",
              timeZone: "America/New_York",
            }).format(new Date())}
          </p>
        </div>
        <PrintReportButton fileName={reportFileName(name)} />
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Net position
        </p>
        <p className={`mt-2 text-4xl font-semibold tabular-nums ${plClass(netPosition)}`}>
          {netPosition > 0 ? "+" : ""}
          {formatCurrencyWhole(netPosition)}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat
            label="Capital deposited"
            value={formatCurrencyWhole(capitalDeposited)}
          />
          <Stat
            label={`${fin.nextYear} forecast P/L`}
            value={`${forecastPl > 0 ? "+" : ""}${formatCurrencyWhole(forecastPl)}`}
            className={plClass(forecastPl)}
          />
          <Stat
            label="Ancillary deposits"
            value={formatCurrencyWhole(ancillaryTotal)}
          />
        </div>

        <p className="mt-3 text-sm text-muted">
          The {fin.nextYear} bill is met by the betting pool first; whatever it
          cannot cover is a company obligation split by equity allocation. This
          is capital deposited, less this person&apos;s share of that remainder,
          plus anything deposited outside either pool. The test is whether{" "}
          {fin.expenses.currentYear} closes with enough funded to cover{" "}
          {fin.nextYear} spend.
          {member
            ? ""
            : ` Taking no part in the betting pool does not remove the obligation — it is driven by company holdings, so a share is still carried here.`}
        </p>

        {netPosition < 0 ? (
          <p className="mt-3 rounded-lg border border-amber-400/30 p-3 text-sm text-amber-200">
            <span className="font-semibold tabular-nums">
              {formatCurrencyWhole(-netPosition)}
            </span>{" "}
            due by 31 December {fin.expenses.currentYear} to bring this to zero.
          </p>
        ) : null}

        {investor && investor.amountDue > 0 ? (
          <p className="mt-3 text-sm text-muted">
            {formatCurrencyWhole(investor.amountDue)} of the allocation is still
            unfunded. Paying it in full would move this to{" "}
            <span
              className={`tabular-nums ${plClass(netPosition + investor.amountDue)}`}
            >
              {netPosition + investor.amountDue > 0 ? "+" : ""}
              {formatCurrencyWhole(netPosition + investor.amountDue)}
            </span>
            .
          </p>
        ) : null}
      </section>

      {investor ? (
        <Card title="Equity">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="IO Allocation" value={formatPct(investor.allocation)} />
            <Stat label="IO Cash Value" value={formatCurrencyWhole(investor.cashValue)} />
            <Stat label="Deposited" value={formatCurrencyWhole(investor.deposit)} />
            <Stat label="Deposit %" value={formatPct(investor.depositPct)} />
            <Stat
              label="Amount Due"
              value={formatCurrencyWhole(investor.amountDue)}
              className={investor.amountDue > 0 ? "text-amber-300" : "text-emerald-400"}
            />
          </div>
        </Card>
      ) : null}

      {member ? (
        <Card title="Betting pool">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Capital deposited" value={formatCurrencyWhole(member.contributed)} />
            <Stat label="Ownership" value={formatPct(member.currentPct)} />
            <Stat label="Value" value={formatCurrencyWhole(member.value)} />
            <Stat
              label="ROI"
              value={`${member.roiAmount >= 0 ? "+" : ""}${formatCurrencyWhole(member.roiAmount)}`}
              className={plClass(member.roiAmount)}
            />
          </div>
          {member.addedDeposits > 0 ? (
            <p className="text-xs text-muted">
              Includes {formatCurrencyWhole(member.addedDeposits)} added after inception, which
              is locked out of gains earned before it landed.
            </p>
          ) : null}
        </Card>
      ) : (
        <Card title="Betting pool">
          <p className="text-sm text-muted">
            No stake in the betting pool
            {person.excluded_from_betting ? " — excluded by design." : "."}
          </p>
        </Card>
      )}

      {member ? (
        <Card title="Expense share and forecast">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label={`${fin.expenses.currentYear} contribution`}
              value={formatCurrencyWhole(member.ytdContribution)}
            />
            <Stat
              label="YTD P/L"
              value={formatCurrencyWhole(member.ytdPl)}
              className={plClass(member.ytdPl)}
            />
            <Stat
              label="Rest of year spend"
              value={formatCurrencyWhole(member.remainingSpend)}
            />
            <Stat
              label="Rest of year P/L"
              value={formatCurrencyWhole(member.remainingPl)}
              className={plClass(member.remainingPl)}
            />
          </div>
        </Card>
      ) : null}

      {depletion ? (
        <Card title="Capital depletion">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Deposits" value={formatCurrencyWhole(depletion.deposits)} />
            <Stat
              label={`${fin.expenses.currentYear} end cash`}
              value={formatCurrencyWhole(depletion.endOfYearCash)}
              className={depletion.endOfYearCash < 0 ? "text-red-400" : ""}
            />
            <Stat
              label={`${fin.nextYear} forecast`}
              value={formatCurrencyWhole(depletion.nextYear)}
              className={plClass(depletion.nextYear)}
            />
            <Stat
              label={`${fin.nextYear} end cash`}
              value={formatCurrencyWhole(depletion.endOfNextYearCash)}
              className={depletion.endOfNextYearCash < 0 ? "text-red-400" : ""}
            />
          </div>
          <p className="text-xs text-muted">
            Depletion draws on deposits, not allocation value.
          </p>
        </Card>
      ) : null}

      <Card title="Deposits">
        {deposits.length === 0 ? (
          <p className="text-sm text-muted">No deposits recorded.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {(["betting", "ancillary", "company"] as DepositKind[]).map((kind) => (
                <Stat
                  key={kind}
                  label={DEPOSIT_KIND_LABELS[kind]}
                  value={formatCurrencyWhole(depositTotal(kind))}
                />
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className={th}>Type</th>
                    <th className={th}>Date</th>
                    <th className={thr}>Amount</th>
                    <th className={th}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className={`${td} font-medium`}>{DEPOSIT_KIND_LABELS[row.kind]}</td>
                      <td className={`${td} text-muted`}>
                        {formatDepositDate(row.deposited_on)}
                      </td>
                      <td className={tdr}>{formatCurrencyWhole(Number(row.amount))}</td>
                      <td className={`${td} text-muted`}>{row.description ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Omitted when empty: an empty card is noise on screen and worse in print. */}
      {reconciliations.length > 0 ? (
        <Card title="Betting reconciliation">
            <p className={`text-sm tabular-nums ${plClass(reconciliationNet)}`}>
              Net {reconciliationNet > 0 ? "+" : ""}
              {formatCurrencyWhole(reconciliationNet)}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className={th}>Date</th>
                    <th className={thr}>Amount</th>
                    <th className={th}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliations.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className={`${td} text-muted`}>
                        {formatReconciliationDate(row.paid_on)}
                      </td>
                      <td className={`${tdr} ${plClass(Number(row.amount))}`}>
                        {Number(row.amount) > 0 ? "+" : ""}
                        {formatCurrencyWhole(Number(row.amount))}
                      </td>
                      <td className={`${td} text-muted`}>{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </Card>
      ) : null}
    </div>
  );
}
