export const BET_EMAIL_TYPES = [
  "upcoming_plays",
  "yesterdays_results",
  "weekly_summary",
] as const;

export type BetEmailType = (typeof BET_EMAIL_TYPES)[number];

export type BetEmailSendRow = {
  id: string;
  batch_id: string;
  email_type: BetEmailType;
  recipient_email: string;
  sent_by: string | null;
  sent_at: string;
  sent_on_date: string;
  play_count: number;
  context_date: string | null;
  context_week_end: string | null;
};

export type BetEmailSendBatch = {
  batch_id: string;
  email_type: BetEmailType;
  recipients: string[];
  sent_at: string;
  sent_on_date: string;
  play_count: number;
  context_date: string | null;
  context_week_end: string | null;
  sent_by_email: string | null;
};

export const BET_EMAIL_TYPE_LABELS: Record<BetEmailType, string> = {
  upcoming_plays: "Upcoming plays",
  yesterdays_results: "Yesterday's results",
  weekly_summary: "Weekly summary",
};

export function isBetEmailType(value: string): value is BetEmailType {
  return (BET_EMAIL_TYPES as readonly string[]).includes(value);
}

export function mapLedgerEmailAction(
  action: "upcoming" | "yesterday" | "weekly",
): BetEmailType {
  switch (action) {
    case "upcoming":
      return "upcoming_plays";
    case "yesterday":
      return "yesterdays_results";
    case "weekly":
      return "weekly_summary";
  }
}

export function isMissingBetEmailSendsTable(message: string | undefined) {
  return Boolean(message?.includes("bet_email_sends"));
}
