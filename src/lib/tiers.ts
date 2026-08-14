export const USER_TIERS = ["employee", "a", "b", "admin"] as const;

export type UserTier = (typeof USER_TIERS)[number];

/** Higher index = more access. Used for minimum-tier checks. */
export const TIER_RANK: Record<UserTier, number> = {
  b: 0,
  a: 1,
  employee: 2,
  admin: 3,
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
