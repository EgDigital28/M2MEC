import { loadFinSummary } from "@/lib/financials/fin-summary-data";
import type { DepositKind } from "@/lib/financials/deposits";
import { createClient } from "@/lib/supabase/server";

export type IndividualPerson = {
  id: string;
  email: string | null;
  display_name: string | null;
  report_alias: string | null;
  tier: string;
  excluded_from_betting: boolean | null;
};

export type IndividualDeposit = {
  id: string;
  kind: DepositKind;
  deposited_on: string;
  amount: number;
  description: string | null;
};

export type IndividualReconciliation = {
  id: string;
  paid_on: string;
  amount: number;
  description: string;
};

/**
 * Everything the individual report needs, loaded once. The on-screen report
 * and the PDF both call this, so the two can differ in presentation but never
 * in the figures.
 */
export async function loadIndividualReport(id: string) {
  const supabase = await createClient();

  const [fin, personResult, depositResult, reconciliationResult] = await Promise.all([
    loadFinSummary(),
    supabase
      .from("profiles")
      .select("id, email, display_name, report_alias, tier, excluded_from_betting")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("capital_deposits")
      .select("id, kind, deposited_on, amount, description")
      .eq("profile_id", id)
      .order("deposited_on", { ascending: false }),
    supabase
      .from("betting_reconciliations")
      .select("id, paid_on, amount, description")
      .eq("profile_id", id)
      .order("paid_on", { ascending: false }),
  ]);

  const person = personResult.data as IndividualPerson | null;

  if (!person) {
    return null;
  }

  const deposits = (depositResult.data ?? []) as IndividualDeposit[];
  const reconciliations = (reconciliationResult.data ?? []) as IndividualReconciliation[];

  const investor = fin.investors.find((row) => row.profileId === id);
  const member = fin.members.find((row) => row.profileId === id);
  const depletion = fin.depletion.find((row) => row.profileId === id);

  const depositTotal = (kind: DepositKind) =>
    deposits
      .filter((row) => row.kind === kind)
      .reduce((sum, row) => sum + Number(row.amount), 0);

  const ancillaryTotal = depositTotal("ancillary");
  const capitalDeposited = investor?.deposit ?? 0;
  const forecastPl = investor ? (fin.shortfallByInvestor.get(investor.key) ?? 0) : 0;

  return {
    fin,
    person,
    name: person.display_name ?? person.report_alias ?? person.email ?? "Unknown",
    investor,
    member,
    depletion,
    deposits,
    reconciliations,
    reconciliationNet: reconciliations.reduce((sum, row) => sum + Number(row.amount), 0),
    depositTotal,
    ancillaryTotal,
    capitalDeposited,
    forecastPl,
    netPosition: capitalDeposited + forecastPl + ancillaryTotal,
  };
}

export type IndividualReport = NonNullable<
  Awaited<ReturnType<typeof loadIndividualReport>>
>;
