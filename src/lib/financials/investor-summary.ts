import { fetchOverallPl } from "@/lib/financials/ledger-summary";
import {
  computeOwnershipPct,
  computeWageringStakeValue,
  type WageringStake,
  type WageringStakeGroup,
} from "@/lib/financials/wagering";
import type { EquityStake } from "@/lib/financials/types";
import { tryCreateAdminClient } from "@/lib/supabase/admin";

const EQUITY_SELECT = `
  id,
  profile_id,
  io_allocation,
  io_cash_value,
  deposit,
  created_at,
  updated_at
`;

const WAGERING_SELECT = `
  id,
  profile_id,
  group_id,
  capital_deposit,
  created_at,
  updated_at,
  group:wagering_stake_groups ( id, name, description )
`;

export type InvestorWageringStake = WageringStake & {
  ownershipPct: number;
  value: number;
  groupTotalCapital: number;
};

export type InvestorFinancialsSummary = {
  equityStake: EquityStake | null;
  wageringStakes: InvestorWageringStake[];
  overallPl: number;
  totalProfitLoss: number;
  totalWageringValue: number;
  reportAlias: string | null;
};

export async function fetchInvestorFinancials(
  profileId: string,
): Promise<InvestorFinancialsSummary> {
  const admin = tryCreateAdminClient();

  if (!admin) {
    throw new Error("service_role_unconfigured");
  }

  const ledger = await fetchOverallPl();

  const { data: equityStake, error: equityError } = await admin
    .from("equity_stakes")
    .select(EQUITY_SELECT)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (equityError) {
    throw equityError;
  }

  const { data: wageringStakes, error: wageringError } = await admin
    .from("wagering_stakes")
    .select(WAGERING_SELECT)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });

  if (wageringError) {
    throw wageringError;
  }

  const stakes = (wageringStakes ?? []) as unknown as WageringStake[];
  const groupIds = [...new Set(stakes.map((stake) => stake.group_id))];

  const groupTotals = new Map<string, number>();

  if (groupIds.length > 0) {
    const { data: groupStakes, error: groupTotalsError } = await admin
      .from("wagering_stakes")
      .select("group_id, capital_deposit")
      .in("group_id", groupIds);

    if (groupTotalsError) {
      throw groupTotalsError;
    }

    for (const row of groupStakes ?? []) {
      const current = groupTotals.get(row.group_id) ?? 0;
      groupTotals.set(row.group_id, current + Number(row.capital_deposit ?? 0));
    }
  }

  const enrichedStakes: InvestorWageringStake[] = stakes.map((stake) => {
    const groupTotalCapital = groupTotals.get(stake.group_id) ?? 0;
    const ownershipPct = computeOwnershipPct(stake.capital_deposit, groupTotalCapital);
    const value = computeWageringStakeValue(ownershipPct, ledger.overallPl);

    return {
      ...stake,
      ownershipPct,
      value,
      groupTotalCapital,
    };
  });

  const totalWageringValue = enrichedStakes.reduce((total, stake) => total + stake.value, 0);

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("report_alias")
    .eq("id", profileId)
    .single();

  if (profileError && !profileError.message.includes("report_alias")) {
    throw profileError;
  }

  return {
    equityStake: (equityStake as EquityStake | null) ?? null,
    wageringStakes: enrichedStakes,
    overallPl: ledger.overallPl,
    totalProfitLoss: ledger.totalProfitLoss,
    totalWageringValue,
    reportAlias: profile?.report_alias?.trim() || null,
  };
}

export type { WageringStakeGroup };
