import type { SupabaseClient } from "@supabase/supabase-js";
import { getTodayDateString, getYesterdayDateString } from "@/lib/bets/calculations";
import type { BetEmailSendBatch, BetEmailSendRow, BetEmailType } from "@/lib/bets/email-sends-types";
import { isMissingAutomatedColumn } from "@/lib/bets/email-sends-types";
import { createClient } from "@/lib/supabase/server";

export type { BetEmailSendBatch, BetEmailSendRow, BetEmailType };
export {
  BET_EMAIL_TYPES,
  BET_EMAIL_TYPE_LABELS,
  isBetEmailType,
  isMissingAutomatedColumn,
  isMissingBetEmailSendsTable,
  mapLedgerEmailAction,
} from "@/lib/bets/email-sends-types";

type LogBetEmailSendsInput = {
  emailType: BetEmailType;
  recipients: string[];
  /** Null for scheduled sends, which have no signed-in admin. */
  sentById: string | null;
  playCount: number;
  contextDate?: string | null;
  contextWeekEnd?: string | null;
  sentOnDate?: string;
  /** True for the scheduled job, false for an admin pressing send. */
  isAutomated?: boolean;
  /** Supplied by callers without a session, such as the cron job. */
  client?: SupabaseClient;
};

export async function logBetEmailSends({
  emailType,
  recipients,
  sentById,
  playCount,
  contextDate = null,
  contextWeekEnd = null,
  sentOnDate = getTodayDateString(),
  isAutomated = false,
  client,
}: LogBetEmailSendsInput) {
  const supabase = client ?? (await createClient());
  const batchId = crypto.randomUUID();

  const baseRows = recipients.map((recipient) => ({
    batch_id: batchId,
    email_type: emailType,
    recipient_email: recipient,
    sent_by: sentById,
    sent_on_date: sentOnDate,
    play_count: playCount,
    context_date: contextDate,
    context_week_end: contextWeekEnd,
  }));

  const { error } = await supabase
    .from("bet_email_sends")
    .insert(baseRows.map((row) => ({ ...row, is_automated: isAutomated })));

  if (!error) {
    return { batchId };
  }

  // Before 019 is applied the column does not exist. Record the send anyway:
  // a missing row would let the scheduled job resend the same digest.
  if (isMissingAutomatedColumn(error.message)) {
    const fallback = await supabase.from("bet_email_sends").insert(baseRows);

    if (fallback.error) {
      throw fallback.error;
    }

    return { batchId, automatedColumnMissing: true };
  }

  throw error;
}

export async function findBetEmailDuplicatesToday(
  emailType: BetEmailType,
  recipients: string[],
  sentOnDate = getTodayDateString(),
) {
  if (recipients.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bet_email_sends")
    .select("recipient_email, sent_at")
    .eq("email_type", emailType)
    .eq("sent_on_date", sentOnDate)
    .in(
      "recipient_email",
      recipients.map((email) => email.toLowerCase()),
    )
    .order("sent_at", { ascending: false });

  if (error) {
    throw error;
  }

  const latestByRecipient = new Map<string, string>();

  for (const row of data ?? []) {
    const email = row.recipient_email.toLowerCase();

    if (!latestByRecipient.has(email)) {
      latestByRecipient.set(email, row.sent_at);
    }
  }

  return recipients
    .filter((email) => latestByRecipient.has(email.toLowerCase()))
    .map((email) => ({
      email,
      sentAt: latestByRecipient.get(email.toLowerCase())!,
    }));
}

export async function fetchBetEmailSendHistory(limit = 50) {
  const sentOnDates = [getYesterdayDateString(), getTodayDateString()];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bet_email_sends")
    .select("*")
    .in("sent_on_date", sentOnDates)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const batches = new Map<string, BetEmailSendBatch>();

  for (const row of (data ?? []) as BetEmailSendRow[]) {
    const existing = batches.get(row.batch_id);

    if (existing) {
      existing.recipients.push(row.recipient_email);
      continue;
    }

    batches.set(row.batch_id, {
      batch_id: row.batch_id,
      email_type: row.email_type,
      recipients: [row.recipient_email],
      sent_at: row.sent_at,
      sent_on_date: row.sent_on_date,
      play_count: row.play_count,
      context_date: row.context_date,
      context_week_end: row.context_week_end,
      sent_by_email: null,
      is_automated: Boolean(row.is_automated),
    });
  }

  return [...batches.values()];
}
