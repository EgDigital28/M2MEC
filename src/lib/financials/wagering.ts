import { sortBySortOrder } from "@/lib/sort";
import {
  formatAllocationPercent,
  formatFinancialAmount,
  normalizeStakeProfileId,
  type EquityStakeholder,
} from "@/lib/financials/types";

export type WageringStakeGroup = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WageringStake = {
  id: string;
  profile_id: string | null;
  group_id: string;
  capital_deposit: number;
  created_at: string;
  updated_at: string;
  profile?: Pick<EquityStakeholder, "id" | "email" | "display_name" | "report_alias" | "tier"> | null;
  group?: Pick<WageringStakeGroup, "id" | "name" | "description"> | null;
};

export function sortWageringGroups(groups: WageringStakeGroup[]) {
  return sortBySortOrder(groups, (a, b) => a.name.localeCompare(b.name));
}

export function wageringGroupLabel(group: Pick<WageringStakeGroup, "name" | "description">) {
  const description = group.description?.trim();
  return description ? `${group.name} — ${description}` : group.name;
}

export function sumCapitalDeposits(stakes: Pick<WageringStake, "capital_deposit">[]) {
  return stakes.reduce((total, stake) => total + stake.capital_deposit, 0);
}

export function computeOwnershipPct(capitalDeposit: number, totalCapitalDeposits: number) {
  if (totalCapitalDeposits <= 0) {
    return 0;
  }

  return (capitalDeposit / totalCapitalDeposits) * 100;
}

export function computeWageringStakeValue(ownershipPct: number, overallPl: number) {
  return (ownershipPct / 100) * overallPl;
}

export function formatGroupId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export { normalizeStakeProfileId };
