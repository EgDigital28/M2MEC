import type { UserTier } from "@/lib/tiers";

export type ManagedUser = {
  id: string;
  email: string;
  display_name: string | null;
  report_alias: string | null;
  tier: UserTier;
  created_at: string;
  registered_at: string | null;
  suspended_at: string | null;
};

export const PROFILE_BASE_COLUMNS = "id, email, display_name, report_alias, tier, created_at";
export const PROFILE_BASE_COLUMNS_WITHOUT_REPORT_ALIAS =
  "id, email, display_name, tier, created_at";
export const PROFILE_COLUMNS = `${PROFILE_BASE_COLUMNS}, registered_at`;
export const PROFILE_COLUMNS_WITHOUT_REPORT_ALIAS = `${PROFILE_BASE_COLUMNS_WITHOUT_REPORT_ALIAS}, registered_at`;
export const PROFILE_COLUMNS_WITH_SUSPENSION = `${PROFILE_COLUMNS}, suspended_at`;
export const PROFILE_COLUMNS_WITH_SUSPENSION_WITHOUT_REPORT_ALIAS =
  `${PROFILE_COLUMNS_WITHOUT_REPORT_ALIAS}, suspended_at`;

export function normalizeReportAlias(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function isMissingReportAliasColumn(message: string | undefined) {
  return Boolean(message?.includes("report_alias"));
}

export function isMissingRegistrationColumn(message: string | undefined) {
  return Boolean(message?.includes("registered_at"));
}

export function withSuspendedAt<T extends Omit<ManagedUser, "suspended_at">>(
  profile: T,
): ManagedUser {
  return { ...profile, suspended_at: null };
}

export function withReportAliasFallback<T extends Omit<ManagedUser, "report_alias">>(
  profile: T,
): ManagedUser {
  return { ...profile, report_alias: null };
}

export function withRegisteredAtFallback<T extends Omit<ManagedUser, "registered_at">>(
  profile: T,
): ManagedUser {
  return { ...profile, registered_at: profile.created_at };
}

export function isMissingSuspensionColumn(message: string | undefined) {
  return Boolean(message?.includes("suspended_at"));
}
