import { LEDGER_STARTING_BALANCE } from "@/lib/bets/calculations";
import {
  computeCapitalLock,
  makePoolValueBefore,
  type LockDeposit,
  type LockResult,
} from "@/lib/financials/capital-lock";
import { createClient } from "@/lib/supabase/server";

/**
 * Loads betting deposits and derives locked ownership. Shared so every surface
 * reports the same split — computing it per screen is how two admin pages end
 * up disagreeing about who owns what.
 */
export async function loadCapitalLock(
  dailyProfitLoss: { date: string; profitLoss: number }[],
): Promise<LockResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("capital_deposits")
    .select("profile_id, deposited_on, amount")
    .eq("kind", "betting")
    .order("deposited_on");

  if (error) {
    throw error;
  }

  const deposits: LockDeposit[] = (
    (data ?? []) as { profile_id: string; deposited_on: string; amount: number }[]
  ).map((row) => ({
    profileId: row.profile_id,
    depositedOn: row.deposited_on,
    amount: Number(row.amount),
  }));

  const inceptionDate =
    deposits.length > 0
      ? deposits.map((d) => d.depositedOn).sort((a, b) => a.localeCompare(b))[0]
      : null;

  return computeCapitalLock(
    deposits,
    makePoolValueBefore({
      openingBankroll: LEDGER_STARTING_BALANCE,
      dailyProfitLoss,
      deposits,
      inceptionDate,
    }),
  );
}
