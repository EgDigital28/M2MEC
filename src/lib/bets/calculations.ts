export const BET_STATUSES = ["Open", "Win", "Loss", "Void"] as const;

export type BetStatus = (typeof BET_STATUSES)[number];

export type BetEntryRow = {
  id: string;
  created_by: string;
  event_date: string;
  sport_id: string;
  event_name: string;
  line: number;
  risk: number;
  status: BetStatus;
  created_at: string;
  updated_at: string;
  sports?: { abbreviation: string; full_name: string } | null;
};

export type BetEntry = Omit<BetEntryRow, "sports"> & {
  sport: string;
};

export type BetEntryComputed = BetEntry & {
  to_win: number;
  profit_loss: number;
};

export function normalizeBetEntry(row: BetEntryRow): BetEntry {
  return {
    id: row.id,
    created_by: row.created_by,
    event_date: row.event_date,
    sport_id: row.sport_id,
    event_name: row.event_name,
    line: row.line,
    risk: row.risk,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sport: row.sports?.abbreviation ?? "Unknown",
  };
}

/** Matches Excel: =IF(line<0, risk/ABS(line)*100, risk*(line/100)) */
export function calculateToWin(line: number, risk: number): number {
  if (line < 0) {
    return (risk / Math.abs(line)) * 100;
  }

  return risk * (line / 100);
}

/** Matches Excel: Open/Void → 0, Win → to_win, Loss → -risk */
export function calculateProfitLoss(
  status: BetStatus,
  risk: number,
  toWin: number,
): number {
  if (status === "Open" || status === "Void") {
    return 0;
  }

  if (status === "Win") {
    return toWin;
  }

  if (status === "Loss") {
    return risk * -1;
  }

  return 0;
}

export function withComputedFields(entry: BetEntry | BetEntryRow): BetEntryComputed {
  const normalized = "sport" in entry ? entry : normalizeBetEntry(entry);
  const to_win = calculateToWin(Number(normalized.line), Number(normalized.risk));

  return {
    ...normalized,
    line: Number(normalized.line),
    risk: Number(normalized.risk),
    to_win,
    profit_loss: calculateProfitLoss(
      normalized.status,
      Number(normalized.risk),
      to_win,
    ),
  };
}

export function formatOdds(line: number): string {
  if (line > 0) {
    return `+${line}`;
  }

  return String(line);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** @deprecated Use formatCurrency for dollar amounts */
export function formatMoney(value: number): string {
  return formatCurrency(value);
}

export function formatEventDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${month}/${day}/${year}`;
}

export function isBetStatus(value: string): value is BetStatus {
  return (BET_STATUSES as readonly string[]).includes(value);
}
