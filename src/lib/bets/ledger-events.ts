/**
 * The games behind a Ledger bet, as saved on bet_entries.ledger_events by the
 * projection: one entry per game, in leg order.
 */
export type LedgerEvent = {
  eventName: string | null;
  startsAt: string | null;
  /** The finished game's result line, when the Ledger has proven one. */
  result: string | null;
};

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const label = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/**
 * The result line for a finished game, from the Ledger's settlement facts:
 * "North Texas Mean Green 45 – Tulsa Golden Hurricane 44 · Final".
 *
 * Only team scores are rendered so far, because only they have arrived to
 * check against. UFC and player-prop facts are stored too, but their values
 * (method spelling, what the time counts) have not been seen yet; until they
 * are, those games keep their game line rather than show a guess.
 */
function resultLine(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const { observed, source } = value as { observed?: Record<string, unknown>; source?: Record<string, unknown> };
  if (!observed || !source || observed.event_status !== "completed") return null;

  const away = label(source.awayParticipantLabel);
  const home = label(source.homeParticipantLabel);
  const awayScore = num(observed.away_score);
  const homeScore = num(observed.home_score);

  return away && home && awayScore !== null && homeScore !== null
    ? `${away} ${awayScore} – ${home} ${homeScore} · Final`
    : null;
}

/** Tolerates null and malformed values, which a hand-entered bet will have. */
export function parseLedgerEvents(value: unknown): LedgerEvent[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { eventName, startsAt, result } = item as Record<string, unknown>;
    const name = typeof eventName === "string" && eventName.trim() ? eventName.trim() : null;
    const start = typeof startsAt === "string" && startsAt ? startsAt : null;
    return name || start ? [{ eventName: name, startsAt: start, result: resultLine(result) }] : [];
  });
}

/**
 * "Sep 27, 2026, 1:00 PM ET" — always Eastern, whoever is looking. Date and
 * time are formatted separately and joined here: formatted together, browsers
 * write "Sep 27, 2026 at 1:00 PM" while the server writes a comma, so the
 * ledger page and the emails would disagree.
 */
export function formatEventStart(startsAt: string) {
  const date = new Date(startsAt);
  if (!Number.isFinite(date.getTime())) return null;

  const eastern = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...options }).format(date);

  return `${eastern({ month: "short", day: "numeric", year: "numeric" })}, ${eastern({ hour: "numeric", minute: "2-digit" })} ET`;
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
  // A finished game shows how it ended, not when it started.
  if (event.result) return event.result;

  const start = event.startsAt
    ? day
      ? formatEventStartOn(event.startsAt, day)
      : formatEventStart(event.startsAt)
    : null;
  return [event.eventName, start].filter(Boolean).join(" · ");
}

/**
 * "Event" before a game is graded and "Result" after, numbered when a bet
 * spans several games: a half-finished parlay reads "Result 1", "Event 2".
 */
export function ledgerEventLabel(index: number, total: number, event?: LedgerEvent) {
  const word = event?.result ? "Result" : "Event";
  return total > 1 ? `${word} ${index + 1}` : word;
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

/** The Eastern calendar day (YYYY-MM-DD) each of a bet's games starts on. */
export function eventDays(value: unknown): string[] {
  return parseLedgerEvents(value).flatMap((event) => {
    if (!event.startsAt) return [];
    const date = new Date(event.startsAt);
    return Number.isFinite(date.getTime())
      ? [new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(date)]
      : [];
  });
}
