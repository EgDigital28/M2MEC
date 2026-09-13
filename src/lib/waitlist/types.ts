export const WAITLIST_STATUSES = ["pending", "welcomed", "invited", "converted"] as const;

export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export type WaitlistSubmission = {
  id: string;
  email: string;
  name: string;
  message: string;
  status: WaitlistStatus;
  welcome_email_sent_at: string | null;
  created_at: string;
};

export const WAITLIST_STATUS_LABELS: Record<WaitlistStatus, string> = {
  pending: "Pending",
  welcomed: "Welcomed",
  invited: "Invited",
  converted: "Converted",
};

export function isWaitlistStatus(value: string): value is WaitlistStatus {
  return (WAITLIST_STATUSES as readonly string[]).includes(value);
}
