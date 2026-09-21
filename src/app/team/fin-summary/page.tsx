import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import {
  computeOverallPl,
  formatCurrencyWhole,
  withComputedFields,
  type BetEntryRow,
} from "@/lib/bets/calculations";
import {
  computeDepletion,
  computePoolMembers,
  formatPct,
  summarizeExpenses,
  type InvestorRow,
  type PoolInput,
} from "@/lib/financials/fin-summary";
import {
  formatContractDate,
  formatIncomeAmount,
  netAnnualAmount,
  recognizedForYear,
  sumRecognizedAcrossYears,
  taxRateFor,
  type IncomeContract,
} from "@/lib/financials/income";

export const dynamic = "force-dynamic";

type ProfileRef = {
  id: string;
  email: string | null;
  display_name: string | null;
  report_alias: string | null;
  excluded_from_betting: boolean | null;
};

function labelFor(profile: ProfileRef | null, fallback: string) {
  return (
    profile?.report_alias ?? profile?.display_name ?? profile?.email ?? fallback
  );
}

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

  const supabase = await createClient();

  // Every graded bet is needed for the bankroll, so page through the row cap.
  const betEntries: BetEntryRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("bet_entries")
      .select("*")
      .order("id")
      .range(offset, offset + 999);

    if (error || !data) break;
    betEntries.push(...(data as BetEntryRow[]));
    if (data.length < 1000) break;
  }

  const [equityResult, wageringResult, expenseResult, incomeResult] =
    await Promise.all([
      supabase
        .from("equity_stakes")
        .select(
          "id, profile_id, io_allocation, io_cash_value, deposit, profiles(id, email, display_name, report_alias, excluded_from_betting)",
        )
        .order("io_allocation", { ascending: false }),
      supabase
        .from("wagering_stakes")
        .select(
          "id, profile_id, capital_deposit, profiles(id, email, display_name, report_alias, excluded_from_betting)",
        )
        .order("capital_deposit", { ascending: false }),
      supabase.from("expense_entries").select("quarter, amount, status"),
      supabase
        .from("income_contracts")
        .select(
          "id, name, counterparty, annual_amount, start_date, end_date, is_active, notes, created_at",
        )
        .order("start_date"),
    ]);

  const bankroll = computeOverallPl(
    betEntries
      .map(withComputedFields)
      .reduce((sum, entry) => sum + entry.profit_loss, 0),
  );

  const expenses = summarizeExpenses(
    (expenseResult.data ?? []) as {
      quarter: string;
      amount: number;
      status: string;
    }[],
  );

  // Pool value is measured against next year's forecast spend, so it carries
  // net income recognised over the same horizon rather than only what has
  // been earned so far.
  const contracts = (incomeResult.data ?? []) as IncomeContract[];
  const incomeRecognized = sumRecognizedAcrossYears(
    contracts,
    expenses.currentYear,
    expenses.currentYear + 1,
  );
  const currentValue = bankroll + incomeRecognized;

  const investors: InvestorRow[] = (
    (equityResult.data ?? []) as unknown as {
      id: string;
      profile_id: string | null;
      io_allocation: number;
      io_cash_value: number;
      deposit: number;
      profiles: ProfileRef | null;
    }[]
  ).map((stake, index) => {
    const cashValue = Number(stake.io_cash_value);
    const deposit = Number(stake.deposit);

    return {
      excludedFromBetting: Boolean(stake.profiles?.excluded_from_betting),
      key: stake.id,
      label: labelFor(stake.profiles, `Investor ${index + 1}`),
      profileId: stake.profile_id,
      allocation: Number(stake.io_allocation) / 100,
      cashValue,
      deposit,
      depositPct: cashValue > 0 ? deposit / cashValue : null,
      amountDue: cashValue - deposit,
    };
  });

  const poolInputs: PoolInput[] = (
    (wageringResult.data ?? []) as unknown as {
      id: string;
      profile_id: string | null;
      capital_deposit: number;
      profiles: ProfileRef | null;
    }[]
  )
    // Flagged investors take no part in the pool, so they never reach the
    // betting tables or the ownership split.
    .filter((stake) => !stake.profiles?.excluded_from_betting)
    .map((stake, index) => ({
      key: stake.id,
      label: labelFor(stake.profiles, `Member ${index + 1}`),
      profileId: stake.profile_id,
      initialDeposit: Number(stake.capital_deposit),
    }));

  const members = computePoolMembers(poolInputs, currentValue, expenses);
  const depletion = computeDepletion(investors, members);

  const valuation = investors.reduce(
    (sum, investor) => sum + investor.cashValue,
    0,
  );
  const totalDeposits = investors.reduce(
    (sum, investor) => sum + investor.deposit,
    0,
  );
  const totalDue = investors.reduce(
    (sum, investor) => sum + investor.amountDue,
    0,
  );
  const totalContributed = members.reduce(
    (sum, member) => sum + member.contributed,
    0,
  );
  const totalRoi = members.reduce((sum, member) => sum + member.roiAmount, 0);
  const nextYear = expenses.currentYear + 1;

  return (
    <div className="space-y-6">
      <section>
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
      </section>

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
          Ownership is the current split. It equals the initial deposit split
          until capital-lock deposit events exist.
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
        subtitle={`Year to date is every ${expenses.currentYear} quarter through Q${expenses.currentQuarter}; the remainder of the year is forecast.`}
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
                <th className={thr}>{nextYear} spend</th>
                <th className={thr}>{nextYear} P/L</th>
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
                  <td className={tdr}>
                    {formatCurrencyWhole(member.nextYearSpend)}
                  </td>
                  <td className={`${tdr} ${plClass(member.nextYearPl)}`}>
                    {formatCurrencyWhole(member.nextYearPl)}
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
                <td className={tdr}>
                  {formatCurrencyWhole(
                    members.reduce((s, m) => s + m.nextYearSpend, 0),
                  )}
                </td>
                <td className={tdr}>
                  {formatCurrencyWhole(
                    members.reduce((s, m) => s + m.nextYearPl, 0),
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="M2MEC capital depletion"
        subtitle="Depletion draws on cash deposited, not allocation value. Cash is only drawn on once a period's forecast P/L turns negative, and investors outside the betting pool never deplete."
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
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
