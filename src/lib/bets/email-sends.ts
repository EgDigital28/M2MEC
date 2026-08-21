import { getTodayDateString } from "@/lib/bets/calculations";
import type { BetEmailSendBatch, BetEmailSendRow, BetEmailType } from "@/lib/bets/email-sends-types";
import { createClient } from "@/lib/supabase/server";

export type { BetEmailSendBatch, BetEmailSendRow, BetEmailType };
export {
  BET_EMAIL_TYPES,
  BET_EMAIL_TYPE_LABELS,
  isBetEmailType,
  isMissingBetEmailSendsTable,
  mapLedgerEmailAction,
} from "@/lib/bets/email-sends-types";

type LogBetEmailSendsInput = {
  emailType: BetEmailType;
  recipients: string[];
  sentById: string;
  playCount: number;
  contextDate?: string | null;
  contextWeekEnd?: string | null;
  sentOnDate?: string;
};

export async function logBetEmailSends({
  emailType,
  recipients,
  sentById,
  playCount,
  contextDate = null,
  contextWeekEnd = null,
  sentOnDate = getTodayDateString(),
}: LogBetEmailSendsInput) {
  const supabase = await createClient();
  const batchId = crypto.randomUUID();

  const rows = recipients.map((recipient) => ({
    batch_id: batchId,
    email_type: emailType,
    recipient_email: recipient,
    sent_by: sentById,
    sent_on_date: sentOnDate,
    play_count: playCount,
    context_date: contextDate,
    context_week_end: contextWeekEnd,
  }));

  const { error } = await supabase.from("bet_email_sends").insert(rows);

  if (error) {
    throw error;
  }

  return { batchId };
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

export async function fetchBetEmailSendHistory(
  sentOnDate = getTodayDateString(),
  limit = 50,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bet_email_sends")
    .select("*")
    .eq("sent_on_date", sentOnDate)
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
    });
  }

  return [...batches.values()];
}
