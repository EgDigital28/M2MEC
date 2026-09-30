export const DEPOSIT_KINDS = ["betting", "company", "ancillary"] as const;

export type DepositKind = (typeof DEPOSIT_KINDS)[number];

export const DEPOSIT_KIND_LABELS: Record<DepositKind, string> = {
  betting: "Betting",
  company: "Capital equity",
  ancillary: "Ancillary",
};

export const DEPOSIT_METHODS = [
  "wire",
  "ach",
  "check",
  "cash",
  "zelle",
  "venmo",
  "cashapp",
  "paypal",
  "apple_pay",
  "crypto",
  "other",
] as const;

export type DepositMethod = (typeof DEPOSIT_METHODS)[number];

export const DEPOSIT_METHOD_LABELS: Record<DepositMethod, string> = {
  wire: "Wire",
  ach: "ACH",
  check: "Check",
  cash: "Cash",
  zelle: "Zelle",
  venmo: "Venmo",
  cashapp: "Cash App",
  paypal: "PayPal",
  apple_pay: "Apple Pay",
  crypto: "Crypto",
  other: "Other",
};

export function isDepositMethod(value: unknown): value is DepositMethod {
  return (DEPOSIT_METHODS as readonly unknown[]).includes(value);
}

/** Unknown values can only arrive from a hand-edited row; show them as-is. */
export function depositMethodLabel(value: string) {
  return isDepositMethod(value) ? DEPOSIT_METHOD_LABELS[value] : value;
}

export type CapitalDeposit = {
  id: string;
  profile_id: string;
  kind: DepositKind;
  method: DepositMethod;
  group_id: string | null;
  deposited_on: string;
  amount: number;
  description: string | null;
  created_at: string;
  profiles?: {
    id: string;
    email: string | null;
    display_name: string | null;
    report_alias: string | null;
  } | null;
};

export const DEPOSIT_COLUMNS =
  "id, profile_id, kind, method, group_id, deposited_on, amount, description, created_at, profiles!capital_deposits_profile_id_fkey(id, email, display_name, report_alias)";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DepositPayload = {
  profile_id?: unknown;
  kind?: unknown;
  method?: unknown;
  group_id?: unknown;
  deposited_on?: unknown;
  amount?: unknown;
  description?: unknown;
};

export function isDepositKind(value: unknown): value is DepositKind {
  return (DEPOSIT_KINDS as readonly unknown[]).includes(value);
}

/** Shared by create and update so both reject the same shapes. */
export function validateDeposit(body: DepositPayload) {
  const profileId = typeof body.profile_id === "string" ? body.profile_id : "";
  const depositedOn = typeof body.deposited_on === "string" ? body.deposited_on : "";
  const amount =
    typeof body.amount === "string"
      ? Number(body.amount.replace(/[,$\s]/g, ""))
      : Number(body.amount);
  const description =
    typeof body.description === "string" && body.description.trim().length > 0
      ? body.description.trim().slice(0, 500)
      : null;

  if (!UUID.test(profileId)) {
    return { error: "Choose a person." as const };
  }

  if (!isDepositKind(body.kind)) {
    return { error: "Choose what the deposit is into." as const };
  }

  if (!isDepositMethod(body.method)) {
    return { error: "Choose how the deposit was made." as const };
  }

  // A betting deposit belongs to exactly one wagering group; a company
  // deposit has none, so ownership can never be applied to the wrong pool.
  const groupId = typeof body.group_id === "string" ? body.group_id : "";

  if (body.kind === "betting" && !UUID.test(groupId)) {
    return { error: "Choose a wagering group." as const };
  }

  if (!ISO_DATE.test(depositedOn) || Number.isNaN(Date.parse(depositedOn))) {
    return { error: "Enter a valid date." as const };
  }

  // Deposits are money in. A withdrawal or settlement belongs in betting
  // reconciliation, which is signed on purpose.
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter an amount greater than zero." as const };
  }

  return {
    values: {
      profile_id: profileId,
      kind: body.kind,
      method: body.method,
      group_id: body.kind === "betting" ? groupId : null,
      deposited_on: depositedOn,
      amount,
      description,
    },
  };
}

export function depositPersonLabel(row: CapitalDeposit) {
  const profile = row.profiles;
  return profile?.display_name ?? profile?.report_alias ?? profile?.email ?? "Unknown";
}

export function sumDeposits(rows: CapitalDeposit[]) {
  return rows.reduce((total, row) => total + Number(row.amount), 0);
}

export function formatDepositDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
