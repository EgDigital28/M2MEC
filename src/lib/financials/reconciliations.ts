export type BettingReconciliation = {
  id: string;
  profile_id: string;
  paid_on: string;
  amount: number;
  description: string;
  created_at: string;
  profiles?: {
    id: string;
    email: string | null;
    display_name: string | null;
    report_alias: string | null;
  } | null;
};

export const RECONCILIATION_COLUMNS =
  "id, profile_id, paid_on, amount, description, created_at, profiles!betting_reconciliations_profile_id_fkey(id, email, display_name, report_alias)";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReconciliationPayload = {
  profile_id?: unknown;
  paid_on?: unknown;
  amount?: unknown;
  description?: unknown;
};

/** Shared by create and update so both reject the same shapes. */
export function validateReconciliation(body: ReconciliationPayload) {
  const profileId = typeof body.profile_id === "string" ? body.profile_id : "";
  const paidOn = typeof body.paid_on === "string" ? body.paid_on : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const amount =
    typeof body.amount === "string"
      ? Number(body.amount.replace(/[,$\s]/g, ""))
      : Number(body.amount);

  if (!UUID.test(profileId)) {
    return { error: "Choose a person." as const };
  }

  if (!ISO_DATE.test(paidOn) || Number.isNaN(Date.parse(paidOn))) {
    return { error: "Enter a valid date." as const };
  }

  // Zero is rejected rather than stored: a payment of nothing is a mistake,
  // and the sign is what distinguishes paid out from collected.
  if (!Number.isFinite(amount) || amount === 0) {
    return { error: "Enter a non-zero amount." as const };
  }

  if (!description || description.length > 500) {
    return { error: "Enter a description of 1 to 500 characters." as const };
  }

  return {
    values: {
      profile_id: profileId,
      paid_on: paidOn,
      amount,
      description,
    },
  };
}

export function reconciliationPersonLabel(row: BettingReconciliation) {
  const profile = row.profiles;
  return (
    profile?.display_name ?? profile?.report_alias ?? profile?.email ?? "Unknown"
  );
}

export function sumReconciliations(rows: BettingReconciliation[]) {
  return rows.reduce((total, row) => total + Number(row.amount), 0);
}

export function formatReconciliationDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
