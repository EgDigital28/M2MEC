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

export function parseRiskAmount(value: string): number {
  return Number.parseFloat(value.replace(/,/g, "")) || Number.NaN;
}

export function formatRiskInput(value: string): string {
  const sanitized = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (!sanitized) {
    return "";
  }

  const [wholePart, ...decimalParts] = sanitized.split(".");
  const decimals = decimalParts.join("").slice(0, 2);
  const formattedWhole = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (decimalParts.length > 0) {
    return `${formattedWhole}.${decimals}`;
  }

  return formattedWhole;
}

export function sanitizeRiskInput(value: string): string {
  return value.replace(/,/g, "").replace(/[^\d.]/g, "").replace(/^(\d*\.\d{0,2}).*$/, "$1");
}

export function isBetStatus(value: string): value is BetStatus {
  return (BET_STATUSES as readonly string[]).includes(value);
}

export function sortBetEntries<T extends { event_date: string; created_at: string }>(
  entries: T[],
): T[] {
  return [...entries].sort((a, b) => {
    const dateCompare = b.event_date.localeCompare(a.event_date);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return b.created_at.localeCompare(a.created_at);
  });
}

export type BetLedgerStats = {
  totalEntries: number;
  totalProfitLoss: number;
  openCount: number;
  winCount: number;
  lossCount: number;
  voidCount: number;
  openRisk: number;
};

export function computeBetLedgerStats(entries: BetEntryComputed[]): BetLedgerStats {
  return entries.reduce(
    (stats, entry) => {
      stats.totalEntries += 1;
      stats.totalProfitLoss += entry.profit_loss;

      if (entry.status === "Open") {
        stats.openCount += 1;
        stats.openRisk += entry.risk;
      } else if (entry.status === "Win") {
        stats.winCount += 1;
      } else if (entry.status === "Loss") {
        stats.lossCount += 1;
      } else if (entry.status === "Void") {
        stats.voidCount += 1;
      }

      return stats;
    },
    {
      totalEntries: 0,
      totalProfitLoss: 0,
      openCount: 0,
      winCount: 0,
      lossCount: 0,
      voidCount: 0,
      openRisk: 0,
    },
  );
}
