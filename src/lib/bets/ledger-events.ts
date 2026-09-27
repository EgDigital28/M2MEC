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

/** "Carolina Panthers vs Cleveland Browns · Sep 27, 2026, 1:00 PM ET" */
export function describeLedgerEvent(event: LedgerEvent) {
  const start = event.startsAt ? formatEventStart(event.startsAt) : null;
  return [event.eventName, start].filter(Boolean).join(" · ");
}

/** "Event" for a single game; "Event 1", "Event 2"… when a bet spans several. */
export function ledgerEventLabel(index: number, total: number) {
  return total > 1 ? `Event ${index + 1}` : "Event";
}
