import { TIER_DESCRIPTIONS, TIER_LABELS, type UserTier } from "@/lib/tiers";

const INVITE_TIERS = ["b", "a", "employee"] as const;

export type InvitableTier = (typeof INVITE_TIERS)[number];

export function isInvitableTier(tier: UserTier): tier is InvitableTier {
  return (INVITE_TIERS as readonly UserTier[]).includes(tier);
}

export function tierConflictMessage(existingTier: UserTier) {
  return `This email is already registered as ${TIER_LABELS[existingTier]}. Each email can only have one access tier.`;
}

export function existingAccountMessage(existingTier: UserTier) {
  return `An account already exists for this email (${TIER_LABELS[existingTier]}). They can sign in or use forgot password.`;
}
