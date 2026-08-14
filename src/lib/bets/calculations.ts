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

export function formatCurrencyWhole(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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
  totalRisked: number;
  openCount: number;
  winCount: number;
  lossCount: number;
  voidCount: number;
  openRisk: number;
  gradedCount: number;
  winPct: number | null;
  roi: number | null;
  avgRiskPerPlay: number | null;
};

export type SportBetStats = {
  sportId: string;
  sport: string;
  sortOrder: number;
  winCount: number;
  lossCount: number;
  voidCount: number;
  openCount: number;
  gradedCount: number;
  totalRisked: number;
  totalProfitLoss: number;
  winPct: number | null;
  roi: number | null;
  hasActivity: boolean;
};

function emptySportAccumulator() {
  return {
    winCount: 0,
    lossCount: 0,
    voidCount: 0,
    openCount: 0,
    totalRisked: 0,
    totalProfitLoss: 0,
  };
}

function finalizeSportStats(
  sportId: string,
  sport: string,
  sortOrder: number,
  raw: ReturnType<typeof emptySportAccumulator>,
): SportBetStats {
  const gradedCount = raw.winCount + raw.lossCount + raw.voidCount;

  return {
    sportId,
    sport,
    sortOrder,
    winCount: raw.winCount,
    lossCount: raw.lossCount,
    voidCount: raw.voidCount,
    openCount: raw.openCount,
    gradedCount,
    totalRisked: raw.totalRisked,
    totalProfitLoss: raw.totalProfitLoss,
    winPct: gradedCount > 0 ? raw.winCount / gradedCount : null,
    roi: raw.totalRisked > 0 ? raw.totalProfitLoss / raw.totalRisked : null,
    hasActivity:
      raw.winCount + raw.lossCount + raw.voidCount + raw.openCount > 0,
  };
}

export function computeBetLedgerStats(entries: BetEntryComputed[]): BetLedgerStats {
  const raw = entries.reduce(
    (stats, entry) => {
      stats.totalEntries += 1;
      stats.totalRisked += entry.risk;
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
      totalRisked: 0,
      openCount: 0,
      winCount: 0,
      lossCount: 0,
      voidCount: 0,
      openRisk: 0,
    },
  );

  const gradedCount = raw.winCount + raw.lossCount + raw.voidCount;

  return {
    ...raw,
    gradedCount,
    winPct: gradedCount > 0 ? raw.winCount / gradedCount : null,
    roi: raw.totalRisked > 0 ? raw.totalProfitLoss / raw.totalRisked : null,
    avgRiskPerPlay:
      raw.totalEntries > 0 ? raw.totalRisked / raw.totalEntries : null,
  };
}

export function computeSportBetStats(
  entries: BetEntryComputed[],
  sports: { id: string; abbreviation: string; sort_order: number }[],
): SportBetStats[] {
  const bySportId = new Map<string, ReturnType<typeof emptySportAccumulator>>();

  for (const entry of entries) {
    const current = bySportId.get(entry.sport_id) ?? emptySportAccumulator();

    current.totalRisked += entry.risk;
    current.totalProfitLoss += entry.profit_loss;

    if (entry.status === "Open") {
      current.openCount += 1;
    } else if (entry.status === "Win") {
      current.winCount += 1;
    } else if (entry.status === "Loss") {
      current.lossCount += 1;
    } else if (entry.status === "Void") {
      current.voidCount += 1;
    }

    bySportId.set(entry.sport_id, current);
  }

  return sports
    .map((sport) =>
      finalizeSportStats(
        sport.id,
        sport.abbreviation,
        sport.sort_order,
        bySportId.get(sport.id) ?? emptySportAccumulator(),
      ),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.sport.localeCompare(b.sport));
}

export function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }

  return `${(value * 100).toFixed(2)}%`;
}

const DEFAULT_BET_TIMEZONE = "America/New_York";

export function getTodayDateString(timeZone = DEFAULT_BET_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

export function getYesterdayDateString(timeZone = DEFAULT_BET_TIMEZONE): string {
  const today = getTodayDateString(timeZone);
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);

  const yesterdayYear = date.getFullYear();
  const yesterdayMonth = String(date.getMonth() + 1).padStart(2, "0");
  const yesterdayDay = String(date.getDate()).padStart(2, "0");

  return `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;
}

function parseDateString(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export type WeekDateRange = {
  weekStart: string;
  weekEnd: string;
};

export function getCurrentWeekRange(timeZone = DEFAULT_BET_TIMEZONE): WeekDateRange {
  const today = getTodayDateString(timeZone);
  const todayDate = parseDateString(today);
  const daysSinceMonday = (todayDate.getDay() + 6) % 7;

  const weekStartDate = new Date(todayDate);
  weekStartDate.setDate(weekStartDate.getDate() - daysSinceMonday);

  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  return {
    weekStart: formatDateString(weekStartDate),
    weekEnd: formatDateString(weekEndDate),
  };
}

export function formatWeekRangeLabel(weekStart: string, weekEnd: string) {
  const start = parseDateString(weekStart);
  const end = parseDateString(weekEnd);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

  if (sameMonth) {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
    }).format(start) + "–" + end.getDate() + ", " + end.getFullYear();
  }

  const startLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(end);

  return `${startLabel} – ${endLabel}`;
}

export function formatWeekRangeShort(weekStart: string, weekEnd: string) {
  return `${formatEventDate(weekStart)} – ${formatEventDate(weekEnd)}`;
}

export type DayResultsStats = {
  playCount: number;
  winCount: number;
  lossCount: number;
  voidCount: number;
  openCount: number;
  gradedCount: number;
  totalProfitLoss: number;
  totalRisked: number;
  gradedRisked: number;
  winPct: number | null;
  roi: number | null;
};

export function computeDayResultsStats(entries: BetEntryComputed[]): DayResultsStats {
  const raw = entries.reduce(
    (stats, entry) => {
      stats.playCount += 1;
      stats.totalRisked += entry.risk;
      stats.totalProfitLoss += entry.profit_loss;

      if (entry.status === "Open") {
        stats.openCount += 1;
      } else if (entry.status === "Win") {
        stats.winCount += 1;
        stats.gradedRisked += entry.risk;
      } else if (entry.status === "Loss") {
        stats.lossCount += 1;
        stats.gradedRisked += entry.risk;
      } else if (entry.status === "Void") {
        stats.voidCount += 1;
        stats.gradedRisked += entry.risk;
      }

      return stats;
    },
    {
      playCount: 0,
      winCount: 0,
      lossCount: 0,
      voidCount: 0,
      openCount: 0,
      totalProfitLoss: 0,
      totalRisked: 0,
      gradedRisked: 0,
    },
  );

  const gradedCount = raw.winCount + raw.lossCount + raw.voidCount;

  return {
    ...raw,
    gradedCount,
    winPct: gradedCount > 0 ? raw.winCount / gradedCount : null,
    roi: raw.gradedRisked > 0 ? raw.totalProfitLoss / raw.gradedRisked : null,
  };
}

export function filterEntriesByEventDate(
  entries: BetEntryComputed[],
  eventDate: string,
): BetEntryComputed[] {
  return entries
    .filter((entry) => entry.event_date === eventDate)
    .sort((a, b) => {
      const sportCompare = a.sport.localeCompare(b.sport);

      if (sportCompare !== 0) {
        return sportCompare;
      }

      return a.event_name.localeCompare(b.event_name);
    });
}

export function filterEntriesByEventDateRange(
  entries: BetEntryComputed[],
  weekStart: string,
  weekEnd: string,
): BetEntryComputed[] {
  return entries
    .filter((entry) => entry.event_date >= weekStart && entry.event_date <= weekEnd)
    .sort((a, b) => {
      const dateCompare = a.event_date.localeCompare(b.event_date);

      if (dateCompare !== 0) {
        return dateCompare;
      }

      const sportCompare = a.sport.localeCompare(b.sport);

      if (sportCompare !== 0) {
        return sportCompare;
      }

      return a.event_name.localeCompare(b.event_name);
    });
}

export function filterOpenPlaysTodayAndUpcoming(
  entries: BetEntryComputed[],
  timeZone = DEFAULT_BET_TIMEZONE,
): BetEntryComputed[] {
  const today = getTodayDateString(timeZone);

  return entries
    .filter((entry) => entry.status === "Open" && entry.event_date >= today)
    .sort((a, b) => {
      const dateCompare = a.event_date.localeCompare(b.event_date);

      if (dateCompare !== 0) {
        return dateCompare;
      }

      const sportCompare = a.sport.localeCompare(b.sport);

      if (sportCompare !== 0) {
        return sportCompare;
      }

      return a.event_name.localeCompare(b.event_name);
    });
}
