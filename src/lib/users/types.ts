import type { UserTier } from "@/lib/tiers";

export type ManagedUser = {
  id: string;
  email: string;
  display_name: string | null;
  tier: UserTier;
  created_at: string;
  suspended_at: string | null;
};

export const PROFILE_COLUMNS = "id, email, display_name, tier, created_at";
export const PROFILE_COLUMNS_WITH_SUSPENSION = `${PROFILE_COLUMNS}, suspended_at`;

export function withSuspendedAt<T extends Omit<ManagedUser, "suspended_at">>(
  profile: T,
): ManagedUser {
  return { ...profile, suspended_at: null };
}

export function isMissingSuspensionColumn(message: string | undefined) {
  return Boolean(message?.includes("suspended_at"));
}
