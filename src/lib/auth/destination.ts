import { hasMinimumTier, type UserTier } from "@/lib/tiers";

export function getDefaultDestination(tier: UserTier, next = "/") {
  if (next !== "/") {
    return next;
  }

  if (tier === "investor") {
    return "/investor";
  }

  if (hasMinimumTier(tier, "employee")) {
    return "/team";
  }

  return "/account";
}
