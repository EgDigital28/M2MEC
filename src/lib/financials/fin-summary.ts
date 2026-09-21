/**
 * Reconstructs the spreadsheet's Fin tab from M2MEC data.
 *
 * Relationships were reverse-engineered from the workbook and reproduce every
 * published figure. Where the sheet hardcodes a value, the derivation that
 * yields the same number is used instead.
 */

export type QuarterTotal = {
  quarter: string;
  year: number;
  index: number;
  amount: number;
};

export type ExpenseOutlook = {
  ytd: number;
  remainingThisYear: number;
  nextYear: number;
  currentYear: number;
  currentQuarter: number;
};

export type PoolMember = {
  key: string;
  label: string;
  profileId: string | null;
  initialDeposit: number;
  addedDeposits: number;
  initialPct: number;
  currentPct: number;
  /** Initial plus any later deposits — the capital actually put in. */
  contributed: number;
  value: number;
  /** Gain over capital contributed, in dollars and as a share of it. */
  roiAmount: number;
  roiPct: number | null;
  ytdContribution: number;
  ytdPl: number;
  remainingSpend: number;
  remainingPl: number;
  nextYearSpend: number;
  nextYearPl: number;
};

export type InvestorRow = {
  key: string;
  label: string;
  profileId: string | null;
  /** Holds equity but takes no part in the betting pool. */
  excludedFromBetting?: boolean;
  allocation: number;
  cashValue: number;
  deposit: number;
  depositPct: number | null;
  amountDue: number;
};

export type DepletionRow = {
  key: string;
  label: string;
  profileId: string | null;
  excludedFromBetting: boolean;
  /** Allocation at the company valuation — what the stake is worth. */
  cashValue: number;
  /** Cash actually paid in. Depletion draws on this, not on the valuation. */
  deposits: number;
  ytd: number;
  remainingThisYear: number;
  endOfYearCash: number;
  nextYear: number;
  endOfNextYearCash: number;
};

const QUARTER = /^([1-4])Q(\d{2})$/;

export function parseQuarter(quarter: string) {
  const match = QUARTER.exec(quarter.trim());
  if (!match) return null;

  return { index: Number(match[1]), year: 2000 + Number(match[2]) };
}

export function currentQuarterIndex(date = new Date()) {
  return Math.floor(date.getUTCMonth() / 3) + 1;
}

/**
 * Year-to-date is every quarter of the current year up to and including the
 * one in progress, which is how the sheet splits $1,252,000 YTD from the
 * $522,000 Q4 forecast.
 */
export function summarizeExpenses(
  entries: { quarter: string; amount: number; status: string }[],
  now = new Date(),
): ExpenseOutlook {
  const currentYear = now.getUTCFullYear();
  const currentQuarter = currentQuarterIndex(now);
  const outlook = {
    ytd: 0,
    remainingThisYear: 0,
    nextYear: 0,
    currentYear,
    currentQuarter,
  };

  for (const entry of entries) {
    if (entry.status === "void") continue;

    const parsed = parseQuarter(entry.quarter);
    if (!parsed) continue;

    const amount = Number(entry.amount);

    if (parsed.year === currentYear) {
      if (parsed.index <= currentQuarter) outlook.ytd += amount;
      else outlook.remainingThisYear += amount;
    } else if (parsed.year === currentYear + 1) {
      outlook.nextYear += amount;
    }
  }

  return outlook;
}

export function quarterTotals(
  entries: { quarter: string; amount: number; status: string }[],
): QuarterTotal[] {
  const byQuarter = new Map<string, QuarterTotal>();

  for (const entry of entries) {
    if (entry.status === "void") continue;

    const parsed = parseQuarter(entry.quarter);
    if (!parsed) continue;

    const existing = byQuarter.get(entry.quarter);

    if (existing) {
      existing.amount += Number(entry.amount);
    } else {
      byQuarter.set(entry.quarter, {
        quarter: entry.quarter,
        year: parsed.year,
        index: parsed.index,
        amount: Number(entry.amount),
      });
    }
  }

  return [...byQuarter.values()].sort(
    (a, b) => a.year - b.year || a.index - b.index,
  );
}

export type PoolInput = {
  key: string;
  label: string;
  profileId: string | null;
  initialDeposit: number;
  addedDeposits?: number;
  /** Set once deposit-event locking exists; falls back to the initial split. */
  currentPct?: number | null;
};

/**
 * Per-member value and expense share.
 *
 * Two deliberate asymmetries carried over from the sheet: year-to-date expense
 * is apportioned on the INITIAL split, because most of it was incurred before
 * any later deposit, while forward-looking spend uses the CURRENT split.
 */
export function computePoolMembers(
  members: PoolInput[],
  currentValue: number,
  expenses: ExpenseOutlook,
): PoolMember[] {
  const totalInitial = members.reduce(
    (sum, member) => sum + member.initialDeposit,
    0,
  );

  const withPct = members.map((member) => {
    const initialPct =
      totalInitial > 0 ? member.initialDeposit / totalInitial : 0;
    return { member, initialPct, currentPct: member.currentPct ?? initialPct };
  });

  return withPct.map(({ member, initialPct, currentPct }) => {
    const value = currentPct * currentValue;
    const contributed = member.initialDeposit + (member.addedDeposits ?? 0);
    const ytdContribution = expenses.ytd * initialPct;
    const ytdPl = value - ytdContribution;
    const remainingSpend = expenses.remainingThisYear * currentPct;
    const nextYearShortfall = Math.max(0, expenses.nextYear - currentValue);

    return {
      key: member.key,
      label: member.label,
      profileId: member.profileId,
      initialDeposit: member.initialDeposit,
      addedDeposits: member.addedDeposits ?? 0,
      initialPct,
      currentPct,
      contributed,
      value,
      roiAmount: value - contributed,
      roiPct: contributed > 0 ? (value - contributed) / contributed : null,
      ytdContribution,
      ytdPl,
      remainingSpend,
      remainingPl: ytdPl - remainingSpend,
      nextYearSpend: expenses.nextYear * currentPct,
      nextYearPl: -nextYearShortfall * currentPct,
    };
  });
}

/**
 * Investor cash is only drawn on when a period's forecast P/L goes negative —
 * while the pool still covers spend, cash is untouched. That is why the sheet
 * shows zero depletion for YTD and Q4 but a real draw in 2027.
 *
 * Every investor is listed, including those outside the betting pool: they hold
 * cash that the model must still account for, it simply never depletes.
 *
 * Depletion draws on cash deposited rather than allocation value: only money
 * actually paid in can be consumed, so an investor who has deposited less than
 * their share of a loss ends negative — that is a balance owed, not a floor to
 * clamp away.
 */
export function computeDepletion(
  investors: InvestorRow[],
  members: PoolMember[],
): DepletionRow[] {
  const byProfile = new Map(
    members
      .filter((member) => member.profileId)
      .map((member) => [member.profileId!, member]),
  );

  return investors.map((investor) => {
    const member = investor.profileId
      ? byProfile.get(investor.profileId)
      : undefined;
    const ytd = 0;
    const remainingThisYear = member ? Math.min(0, member.remainingPl) : 0;
    const endOfYearCash = investor.deposit + ytd + remainingThisYear;
    const nextYear = member ? Math.min(0, member.nextYearPl) : 0;

    return {
      key: investor.key,
      label: investor.label,
      profileId: investor.profileId,
      excludedFromBetting: Boolean(investor.excludedFromBetting),
      cashValue: investor.cashValue,
      deposits: investor.deposit,
      ytd,
      remainingThisYear,
      endOfYearCash,
      nextYear,
      endOfNextYearCash: endOfYearCash + nextYear,
    };
  });
}

export function formatPct(value: number | null, digits = 2) {
  return value == null ? "—" : `${(value * 100).toFixed(digits)}%`;
}
