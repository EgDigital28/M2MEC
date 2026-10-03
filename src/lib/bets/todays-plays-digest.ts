import type { SupabaseClient } from "@supabase/supabase-js";
import { withComputedFields, type BetEntryComputed, type BetEntryRow } from "@/lib/bets/calculations";
import { compareWithinDay } from "@/lib/bets/ledger-events";
import { splitTodaysPlays, type TodaysPlaysSplit } from "@/lib/bets/todays-plays-split";

/**
 * Every play dated today, whatever its status. Today's plays covers the whole
 * day, so a play graded this afternoon still belongs in this evening's email.
 */
export async function loadTodaysPlays(db: SupabaseClient, date: string) {
  const { data, error } = await db
    .from("bet_entries")
    .select("*, sports(abbreviation, full_name)")
    .eq("event_date", date)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as BetEntryRow[]).map((row) => withComputedFields(row));
}

/**
 * When today's plays last went to each person today, whoever sent it — the
 * scheduled check or the manual button. Compared in lower case because the
 * manual button stores addresses as typed.
 */
export async function lastTodaysPlaysSends(db: SupabaseClient, date: string) {
  const { data, error } = await db
    .from("bet_email_sends")
    .select("recipient_email, sent_at")
    .eq("email_type", "upcoming_plays")
    .eq("context_date", date)
    .order("sent_at", { ascending: false });

  if (error) throw new Error(error.message);

  const latest = new Map<string, string>();
  for (const row of data ?? []) {
    const email = String(row.recipient_email).toLowerCase();
    if (!latest.has(email)) latest.set(email, row.sent_at);
  }
  return latest;
}

export type TodaysPlaysDigest = TodaysPlaysSplit & {
  recipient: string;
  lastSentAt: string | null;
  /** The check sends only when this person has something new. */
  shouldSend: boolean;
  /** Plays already placed on tomorrow's games, shown when there are any. */
  lookahead: BetEntryComputed[];
};

/** The day after `date` (both YYYY-MM-DD). */
export function dayAfter(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

/**
 * Plays on tomorrow's games, in the same order as today's. They ride along in
 * a today's plays email; on their own they do not trigger one, since
 * tomorrow's first email lists them anyway.
 */
export async function loadLookahead(db: SupabaseClient, date: string) {
  return (await loadTodaysPlays(db, dayAfter(date))).sort(compareWithinDay);
}

/** What the next check would send to each person, right now. */
export async function buildTodaysPlaysDigests(
  db: SupabaseClient,
  recipients: string[],
  date: string,
) {
  const [entries, latest, lookahead] = await Promise.all([
    loadTodaysPlays(db, date),
    lastTodaysPlaysSends(db, date),
    loadLookahead(db, date),
  ]);

  return recipients.map((recipient): TodaysPlaysDigest => {
    const lastSentAt = latest.get(recipient.toLowerCase()) ?? null;
    const split = splitTodaysPlays(entries, lastSentAt);
    return { ...split, recipient, lastSentAt, shouldSend: split.newPlays.length > 0, lookahead };
  });
}
