import { redirect } from "next/navigation";
import { FinSummaryIndividualPicker } from "@/components/FinSummaryIndividualPicker";
import { PrintReportButton } from "@/components/PrintReportButton";
import { getCurrentProfile } from "@/lib/auth/profile";
import { formatCurrencyWhole } from "@/lib/bets/calculations";
import { formatPct } from "@/lib/financials/fin-summary";
import { loadFinSummary } from "@/lib/financials/fin-summary-data";
import {
  formatContractDate,
  formatIncomeAmount,
  netAnnualAmount,
  recognizedForYear,
  taxRateFor,
} from "@/lib/financials/income";

export const dynamic = "force-dynamic";

function plClass(value: number) {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-muted";
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const th = "px-3 py-2 text-left text-xs font-medium text-muted";
const thr = "px-3 py-2 text-right text-xs font-medium text-muted";
const td = "px-3 py-2";
const tdr = "px-3 py-2 text-right tabular-nums";

export default async function FinSummaryPage() {
  const profile = await getCurrentProfile();

  if (profile?.tier !== "admin") {
    redirect("/team");
  }

  const {
    bankroll,
    contracts,
    incomeRecognized,
    currentValue,
    expenses,
    investors,
    members,
    depletion,
    lock,
    valuation,
    totalDeposits,
    totalDue,
    totalContributed,
    totalRoi,
    nextYear,
  } = await loadFinSummary();

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          Admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Fin Summary
        </h1>
        <p className="mt-2 text-sm text-muted">
          Company equity, the betting pool, revenue and the expense outlook,
          built from ledger, expense and income data.
        </p>
        </div>
        <PrintReportButton />
      </section>

      <FinSummaryIndividualPicker
        people={investors.map((investor) => ({
          id: investor.profileId ?? "",
          label: investor.label,
        }))}
      />

      <Card
        title="Company"
        subtitle={`Valuation ${formatCurrencyWhole(valuation)}, the sum of investor cash values.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={th}>Investor</th>
                <th className={thr}>IO Allocation</th>
                <th className={thr}>IO Cash Value</th>
                <th className={thr}>Deposit</th>
                <th className={thr}>Deposit %</th>
                <th className={thr}>Amount Due</th>
              </tr>
            </thead>
            <tbody>
              {investors.map((investor) => (
                <tr key={investor.key} className="border-b border-border/60">
                  <td className={`${td} font-medium`}>
                    {investor.label}
                    {investor.excludedFromBetting ? (
                      <span
                        className="ml-2 rounded border border-border px-1 text-[10px] font-normal text-muted"
                        title="Holds equity but takes no part in the betting pool"
                      >
                        No betting
                      </span>
                    ) : null}
                  </td>
                  <td className={tdr}>{formatPct(investor.allocation)}</td>
                  <td className={tdr}>
                    {formatCurrencyWhole(investor.cashValue)}
                  </td>
                  <td className={tdr}>
                    {formatCurrencyWhole(investor.deposit)}
                  </td>
                  <td className={tdr}>{formatPct(investor.depositPct)}</td>
                  <td className={tdr}>
                    {formatCurrencyWhole(investor.amountDue)}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={td}>Total</td>
                <td className={tdr}>
                  {formatPct(
                    investors.reduce((sum, i) => sum + i.allocation, 0),
                  )}
                </td>
                <td className={tdr}>{formatCurrencyWhole(valuation)}</td>
                <td className={tdr}>{formatCurrencyWhole(totalDeposits)}</td>
                <td className={tdr} />
                <td className={tdr}>{formatCurrencyWhole(totalDue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Betting"
        subtitle={`Current value ${formatCurrencyWhole(currentValue)} — ledger balance ${formatCurrencyWhole(bankroll)} plus ${formatIncomeAmount(incomeRecognized)} net income recognised across ${expenses.currentYear} and ${expenses.currentYear + 1}.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={th}>Individual</th>
                <th className={thr}>Cap Deposit</th>
                <th className={thr}>% Ownership</th>
                <th className={thr}>Value</th>
                <th className={thr}>ROI</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.key} className="border-b border-border/60">
                  <td className={`${td} font-medium`}>{member.label}</td>
                  <td className={tdr}>
                    {formatCurrencyWhole(member.contributed)}
                  </td>
                  <td className={tdr}>{formatPct(member.currentPct)}</td>
                  <td className={tdr}>{formatCurrencyWhole(member.value)}</td>
                  <td className={`${tdr} ${plClass(member.roiAmount)}`}>
                    {member.roiAmount >= 0 ? "+" : ""}
                    {formatCurrencyWhole(member.roiAmount)}
                    <span className="ml-2 text-xs">
                      {member.roiPct == null
                        ? ""
                        : `${member.roiPct >= 0 ? "+" : ""}${formatPct(member.roiPct, 1)}`}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={td}>Total</td>
                <td className={tdr}>{formatCurrencyWhole(totalContributed)}</td>
                <td className={tdr} />
                <td className={tdr}>
                  {formatCurrencyWhole(members.reduce((s, m) => s + m.value, 0))}
                </td>
                <td className={`${tdr} ${plClass(totalRoi)}`}>
                  {totalRoi >= 0 ? "+" : ""}
                  {formatCurrencyWhole(totalRoi)}
                  <span className="ml-2 text-xs">
                    {totalContributed > 0
                      ? `${totalRoi >= 0 ? "+" : ""}${formatPct(totalRoi / totalContributed, 1)}`
                      : ""}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">
          Ownership is the locked current split: each deposit after inception
          freezes existing holders at their value that day, so later capital
          claims no share of earlier gains.
          {lock.events.length > 0
            ? ` ${lock.events.length} lock ${lock.events.length === 1 ? "event" : "events"} applied.`
            : ""}
        </p>
      </Card>

      <Card
        title="Revenue"
        subtitle="Annual contracts recognised daily across calendar years."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={th}>Contract</th>
                <th className={th}>Term</th>
                <th className={thr}>Annual</th>
                <th className={thr}>Net annual</th>
                <th className={thr}>{expenses.currentYear} net</th>
                <th className={thr}>{nextYear} net</th>
                <th className={thr}>Total net</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted">
                    No income contracts yet.
                  </td>
                </tr>
              ) : (
                contracts.map((contract) => (
                  <tr key={contract.id} className="border-b border-border/60">
                    <td className={`${td} font-medium`}>{contract.name}</td>
                    <td className={`${td} text-muted`}>
                      {formatContractDate(contract.start_date)} —{" "}
                      {contract.end_date
                        ? formatContractDate(contract.end_date)
                        : "ongoing"}
                    </td>
                    <td className={tdr}>
                      {formatIncomeAmount(Number(contract.annual_amount))}
                    </td>
                    <td className={tdr}>
                      {formatIncomeAmount(netAnnualAmount(contract))}
                      <span className="ml-2 text-xs text-muted">
                        less {(taxRateFor(contract) * 100).toFixed(0)}% tax
                      </span>
                    </td>
                    <td className={tdr}>
                      {formatIncomeAmount(
                        recognizedForYear(contract, expenses.currentYear)
                          .amount,
                      )}
                    </td>
                    <td className={tdr}>
                      {formatIncomeAmount(
                        recognizedForYear(contract, nextYear).amount,
                      )}
                    </td>
                    <td className={tdr}>
                      {formatIncomeAmount(
                        recognizedForYear(contract, expenses.currentYear)
                          .amount + recognizedForYear(contract, nextYear).amount,
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Betting value less expense"
        subtitle={`Operating expense while the pool funds it, shared by pool ownership. Year to date is every ${expenses.currentYear} quarter through Q${expenses.currentQuarter}; the remainder of the year is forecast. ${nextYear} spend beyond the pool is a company obligation and appears under capital depletion.`}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              YTD expense
            </p>
            <p className="mt-2 text-xl font-semibold tabular-nums">
              {formatCurrencyWhole(expenses.ytd)}
            </p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              Q{expenses.currentQuarter + 1}–Q4 forecast
            </p>
            <p className="mt-2 text-xl font-semibold tabular-nums">
              {formatCurrencyWhole(expenses.remainingThisYear)}
            </p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              {nextYear} forecast
            </p>
            <p className="mt-2 text-xl font-semibold tabular-nums">
              {formatCurrencyWhole(expenses.nextYear)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={th}>Individual</th>
                <th className={thr}>YTD Contribution</th>
                <th className={thr}>YTD P/L</th>
                <th className={thr}>Rest of year spend</th>
                <th className={thr}>Rest of year P/L</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.key} className="border-b border-border/60">
                  <td className={`${td} font-medium`}>{member.label}</td>
                  <td className={tdr}>
                    {formatCurrencyWhole(member.ytdContribution)}
                  </td>
                  <td className={`${tdr} ${plClass(member.ytdPl)}`}>
                    {formatCurrencyWhole(member.ytdPl)}
                  </td>
                  <td className={tdr}>
                    {formatCurrencyWhole(member.remainingSpend)}
                  </td>
                  <td className={`${tdr} ${plClass(member.remainingPl)}`}>
                    {formatCurrencyWhole(member.remainingPl)}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={td}>Total</td>
                <td className={tdr}>
                  {formatCurrencyWhole(
                    members.reduce((s, m) => s + m.ytdContribution, 0),
                  )}
                </td>
                <td className={tdr}>
                  {formatCurrencyWhole(
                    members.reduce((s, m) => s + m.ytdPl, 0),
                  )}
                </td>
                <td className={tdr}>
                  {formatCurrencyWhole(
                    members.reduce((s, m) => s + m.remainingSpend, 0),
                  )}
                </td>
                <td className={tdr}>
                  {formatCurrencyWhole(
                    members.reduce((s, m) => s + m.remainingPl, 0),
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="M2MEC capital depletion"
        subtitle={`The ${nextYear} bill is met by the betting pool first; the remainder is a company obligation split by equity allocation, so an investor outside the pool still carries a share. Depletion draws on cash deposited, not allocation value.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={th}>Individual</th>
                <th className={thr}>Cash Value</th>
                <th className={thr}>Deposits</th>
                <th className={thr}>YTD</th>
                <th className={thr}>Rest of year</th>
                <th className={thr}>{expenses.currentYear} end cash</th>
                <th className={thr}>{nextYear} forecast</th>
                <th className={thr}>{nextYear} end cash</th>
              </tr>
            </thead>
            <tbody>
              {depletion.map((row) => (
                <tr key={row.key} className="border-b border-border/60">
                  <td className={`${td} font-medium`}>
                    {row.label}
                    {row.excludedFromBetting ? (
                      <span
                        className="ml-2 rounded border border-border px-1 text-[10px] font-normal text-muted"
                        title="Outside the betting pool, so cash never depletes"
                      >
                        No betting
                      </span>
                    ) : null}
                  </td>
                  <td className={tdr}>{formatCurrencyWhole(row.cashValue)}</td>
                  <td className={tdr}>{formatCurrencyWhole(row.deposits)}</td>
                  <td className={tdr}>{formatCurrencyWhole(row.ytd)}</td>
                  <td className={`${tdr} ${plClass(row.remainingThisYear)}`}>
                    {formatCurrencyWhole(row.remainingThisYear)}
                  </td>
                  <td className={`${tdr} ${row.endOfYearCash < 0 ? "text-red-400" : ""}`}>
                    {formatCurrencyWhole(row.endOfYearCash)}
                  </td>
                  <td className={`${tdr} ${plClass(row.nextYear)}`}>
                    {formatCurrencyWhole(row.nextYear)}
                  </td>
                  <td className={`${tdr} ${row.endOfNextYearCash < 0 ? "text-red-400" : ""}`}>
                    {formatCurrencyWhole(row.endOfNextYearCash)}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={td}>Total</td>
                <td className={tdr}>{formatCurrencyWhole(valuation)}</td>
                <td className={tdr}>{formatCurrencyWhole(totalDeposits)}</td>
                <td className={tdr} />
                <td className={tdr} />
                <td className={tdr}>
                  {formatCurrencyWhole(
                    depletion.reduce((sum, row) => sum + row.endOfYearCash, 0),
                  )}
                </td>
                <td className={tdr}>
                  {formatCurrencyWhole(
                    depletion.reduce((sum, row) => sum + row.nextYear, 0),
                  )}
                </td>
                <td className={tdr}>
                  {formatCurrencyWhole(
                    depletion.reduce(
                      (sum, row) => sum + row.endOfNextYearCash,
                      0,
                    ),
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">
          Forecasts and depletion are calculated against total deposits of{" "}
          {formatCurrencyWhole(totalDeposits)}, not the{" "}
          {formatCurrencyWhole(valuation)} of allocation value. An investor can
          end negative where their share of a loss exceeds what they have paid
          in.
        </p>
      </Card>
    </div>
  );
}
