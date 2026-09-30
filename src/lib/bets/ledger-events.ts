/**
 * The games behind a Ledger bet, as saved on bet_entries.ledger_events by the
 * projection: one entry per game, in leg order.
 */
export type LedgerEvent = { eventName: string | null; startsAt: string | null };

/** Tolerates null and malformed values, which a hand-entered bet will have. */
export function parseLedgerEvents(value: unknown): LedgerEvent[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { eventName, startsAt } = item as Record<string, unknown>;
    const name = typeof eventName === "string" && eventName.trim() ? eventName.trim() : null;
    const start = typeof startsAt === "string" && startsAt ? startsAt : null;
    return name || start ? [{ eventName: name, startsAt: start }] : [];
  });
}

/** "Sep 27, 2026, 1:00 PM ET" — always Eastern, whoever is looking. */
export function formatEventStart(startsAt: string) {
  const date = new Date(startsAt);
  if (!Number.isFinite(date.getTime())) return null;

  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(date)} ET`;
}

/**
 * "1:00 PM ET" when the game is on `day` (YYYY-MM-DD, Eastern), otherwise
 * "Sep 28, 1:00 PM ET". For views that are already about one day.
 */
export function formatEventStartOn(startsAt: string, day: string) {
  const date = new Date(startsAt);
  if (!Number.isFinite(date.getTime())) return null;

  const eastern = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...options }).format(date);
  const gameDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(date);
  const time = eastern({ hour: "numeric", minute: "2-digit" });

  return gameDay === day
    ? `${time} ET`
    : `${eastern({ month: "short", day: "numeric" })}, ${time} ET`;
}

/**
 * "Carolina Panthers vs Cleveland Browns · Sep 27, 2026, 1:00 PM ET", or with
 * `day` given, the shorter "… · 1:00 PM ET" for a game on that day.
 */
export function describeLedgerEvent(event: LedgerEvent, day?: string) {
  const start = event.startsAt
    ? day
      ? formatEventStartOn(event.startsAt, day)
      : formatEventStart(event.startsAt)
    : null;
  return [event.eventName, start].filter(Boolean).join(" · ");
}

/** "Event" for a single game; "Event 1", "Event 2"… when a bet spans several. */
export function ledgerEventLabel(index: number, total: number) {
  return total > 1 ? `Event ${index + 1}` : "Event";
}

/**
 * When the bet's deciding game starts. For a parlay that is its latest game,
 * not its last-listed leg: the Ledger does not always list legs in kick-off
 * order, and a parlay is not settled until its latest game is.
 */
export function lastEventStart(value: unknown): number | null {
  const starts = parseLedgerEvents(value)
    .map((event) => (event.startsAt ? Date.parse(event.startsAt) : Number.NaN))
    .filter((time) => Number.isFinite(time));

  return starts.length ? Math.max(...starts) : null;
}

type DayOrderable = { status: string; created_at: string; ledger_events?: unknown };

/**
 * Order within one day: plays still open first, graded plays at the bottom,
 * each group by game time. A play with no game time (a hand-entered one)
 * follows the timed plays in its group, in the order it was added.
 */
export function compareWithinDay(a: DayOrderable, b: DayOrderable) {
  const aDone = a.status !== "Open";
  const bDone = b.status !== "Open";
  if (aDone !== bDone) return aDone ? 1 : -1;

  const aStart = lastEventStart(a.ledger_events);
  const bStart = lastEventStart(b.ledger_events);
  if (aStart !== null && bStart !== null && aStart !== bStart) return aStart - bStart;
  if (aStart === null && bStart !== null) return 1;
  if (aStart !== null && bStart === null) return -1;

  return Date.parse(a.created_at) - Date.parse(b.created_at);
}
