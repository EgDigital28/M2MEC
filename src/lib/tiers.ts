export const USER_TIERS = ["employee", "a", "b", "investor", "admin"] as const;

export type UserTier = (typeof USER_TIERS)[number];

/** Higher index = more access. Used for minimum-tier checks. */
export const TIER_RANK: Record<UserTier, number> = {
  b: 0,
  a: 1,
  investor: 2,
  employee: 3,
  admin: 4,
};

export function hasMinimumTier(
  userTier: UserTier,
  requiredTier: UserTier,
): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}

export function isUserTier(value: string): value is UserTier {
  return (USER_TIERS as readonly string[]).includes(value);
}

export const TIER_LABELS: Record<UserTier, string> = {
  b: "Tier B",
  a: "Tier A",
  investor: "Investor",
  employee: "Employee",
  admin: "Admin",
};

export const TIER_DESCRIPTIONS: Record<UserTier, string> = {
  b: "Limited product access",
  a: "Full product access",
  investor: "Investor access",
  employee: "Internal team tools",
  admin: "Full internal access + invites",
};
