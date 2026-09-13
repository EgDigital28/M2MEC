import {
  computeBetLedgerStats,
  computeOverallPl,
  withComputedFields,
  type BetEntryRow,
} from "@/lib/bets/calculations";
import { createClient } from "@/lib/supabase/server";

export async function fetchOverallPl() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("bet_entries").select("*");

  if (error) {
    throw error;
  }

  const entries = ((data ?? []) as BetEntryRow[]).map((row) => withComputedFields(row));
  const stats = computeBetLedgerStats(entries);

  return {
    totalProfitLoss: stats.totalProfitLoss,
    overallPl: computeOverallPl(stats.totalProfitLoss),
  };
}
