import {
  computeOverallPl,
  LEDGER_STARTING_BALANCE,
  withComputedFields,
  type BetEntryRow,
} from "@/lib/bets/calculations";
import {
  computeCapitalLock,
  makePoolValueBefore,
  type LockDeposit,
} from "@/lib/financials/capital-lock";
import {
  computeDepletion,
  computePoolMembers,
  summarizeExpenses,
  type InvestorRow,
  type PoolInput,
} from "@/lib/financials/fin-summary";
import { sumRecognizedAcrossYears, type IncomeContract } from "@/lib/financials/income";
import { createClient } from "@/lib/supabase/server";

export type ProfileRef = {
  id: string;
  email: string | null;
  display_name: string | null;
  report_alias: string | null;
  excluded_from_betting: boolean | null;
};

export function labelFor(profile: ProfileRef | null, fallback: string) {
  return (
    profile?.report_alias ?? profile?.display_name ?? profile?.email ?? fallback
  );
}

/**
 * Loads and derives the whole Fin model once. Both the summary and the
 * per-person view read from here so they cannot disagree.
 */
export async function loadFinSummary() {
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

  const [
    equityResult,
    wageringResult,
    expenseResult,
    bettingDepositResult,
    incomeResult,
  ] =
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
        .from("capital_deposits")
        .select("profile_id, deposited_on, amount")
        .eq("kind", "betting")
        .order("deposited_on"),
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

  // Ownership comes from the capital lock: deposits made after inception
  // cannot claim a share of gains earned before they landed.
  const bettingDeposits: LockDeposit[] = (
    (bettingDepositResult.data ?? []) as {
      profile_id: string;
      deposited_on: string;
      amount: number;
    }[]
  ).map((row) => ({
    profileId: row.profile_id,
    depositedOn: row.deposited_on,
    amount: Number(row.amount),
  }));

  const dailyProfitLoss = betEntries.map(withComputedFields).map((entry) => ({
    date: entry.event_date,
    profitLoss: entry.profit_loss,
  }));

  const inceptionDate =
    bettingDeposits.length > 0
      ? bettingDeposits
          .map((deposit) => deposit.depositedOn)
          .sort((a, b) => a.localeCompare(b))[0]
      : null;

  const lock = computeCapitalLock(
    bettingDeposits,
    makePoolValueBefore({
      openingBankroll: LEDGER_STARTING_BALANCE,
      dailyProfitLoss,
      deposits: bettingDeposits,
      inceptionDate,
    }),
  );

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
    .map((stake, index) => {
      const added = stake.profile_id
        ? (lock.addedByProfile.get(stake.profile_id) ?? 0)
        : 0;

      return {
        key: stake.id,
        label: labelFor(stake.profiles, `Member ${index + 1}`),
        profileId: stake.profile_id,
        // capital_deposit is the total contributed; the opening portion is
        // whatever was not added at a later lock event.
        initialDeposit: Number(stake.capital_deposit) - added,
        addedDeposits: added,
        currentPct: stake.profile_id
          ? (lock.ownership.get(stake.profile_id) ?? null)
          : null,
      };
    });

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
  return {
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
  };
}

export type FinSummaryData = Awaited<ReturnType<typeof loadFinSummary>>;
