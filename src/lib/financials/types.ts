import { formatExpenseAmount, formatExpenseInput, parseExpenseAmount } from "@/lib/expenses/types";
import type { UserTier } from "@/lib/tiers";
import { TIER_LABELS } from "@/lib/tiers";

export type EquityStakeholder = {
  id: string;
  email: string;
  display_name: string | null;
  tier: UserTier;
  registered_at: string | null;
};

export const UNALLOCATED_INVESTOR_LABEL = "Un-Allocated";

export type EquityStake = {
  id: string;
  profile_id: string | null;
  io_allocation: number;
  io_cash_value: number;
  deposit: number;
  created_at: string;
  updated_at: string;
  profile?: Pick<EquityStakeholder, "id" | "email" | "display_name" | "tier"> | null;
};

export function formatFinancialAmount(amount: number) {
  return formatExpenseAmount(amount);
}

export function formatFinancialInput(value: string) {
  return formatExpenseInput(value);
}

export function parseFinancialAmount(value: string) {
  return parseExpenseAmount(value);
}

export function computeDepositPct(deposit: number, ioCashValue: number) {
  if (ioCashValue <= 0) {
    return 0;
  }

  return deposit / ioCashValue;
}

export function computeAmountDue(ioCashValue: number, deposit: number) {
  return ioCashValue - deposit;
}

export function formatAllocationPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

export function formatDepositPct(deposit: number, ioCashValue: number) {
  return formatAllocationPercent(computeDepositPct(deposit, ioCashValue) * 100);
}

export function stakeholderLabel(stakeholder: Pick<EquityStakeholder, "email" | "display_name" | "tier">) {
  const name = stakeholder.display_name?.trim() || stakeholder.email;
  return `${name} (${TIER_LABELS[stakeholder.tier]})`;
}

export function investorDisplayLabel(
  stake: Pick<EquityStake, "profile_id" | "profile">,
  stakeholders: EquityStakeholder[] = [],
) {
  const joined = stake.profile;
  if (joined && !Array.isArray(joined)) {
    return stakeholderLabel(joined);
  }

  if (stake.profile_id) {
    const stakeholder = stakeholders.find((item) => item.id === stake.profile_id);
    if (stakeholder) {
      return stakeholderLabel(stakeholder);
    }
  }

  return UNALLOCATED_INVESTOR_LABEL;
}

export function normalizeStakeProfileId(profileId: string | null | undefined) {
  return profileId?.trim() ? profileId.trim() : null;
}

export function sumAllocations(stakes: Pick<EquityStake, "io_allocation">[]) {
  return stakes.reduce((total, stake) => total + stake.io_allocation, 0);
}

export function validateAllocationTotal(
  stakes: Pick<EquityStake, "id" | "io_allocation">[],
  nextAllocation: number,
  excludeId?: string,
) {
  const total = stakes
    .filter((stake) => stake.id !== excludeId)
    .reduce((sum, stake) => sum + stake.io_allocation, 0);

  const projected = total + nextAllocation;

  if (projected > 100) {
    const remaining = Math.max(0, 100 - total);
    return {
      ok: false as const,
      total,
      remaining,
      message: `Total IO allocation cannot exceed 100%. Remaining available: ${remaining.toFixed(2)}%.`,
    };
  }

  return {
    ok: true as const,
    total: projected,
    remaining: 100 - projected,
  };
}
