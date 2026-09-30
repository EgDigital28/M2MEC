import type { SupabaseClient } from "@supabase/supabase-js";
import { withComputedFields, type BetEntryRow } from "@/lib/bets/calculations";
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
};

/** What the next check would send to each person, right now. */
export async function buildTodaysPlaysDigests(
  db: SupabaseClient,
  recipients: string[],
  date: string,
) {
  const [entries, latest] = await Promise.all([
    loadTodaysPlays(db, date),
    lastTodaysPlaysSends(db, date),
  ]);

  return recipients.map((recipient): TodaysPlaysDigest => {
    const lastSentAt = latest.get(recipient.toLowerCase()) ?? null;
    const split = splitTodaysPlays(entries, lastSentAt);
    return { ...split, recipient, lastSentAt, shouldSend: split.newPlays.length > 0 };
  });
}
