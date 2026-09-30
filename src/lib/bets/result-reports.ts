import type { SupabaseClient } from "@supabase/supabase-js";
import { withComputedFields, type BetEntryComputed, type BetEntryRow } from "@/lib/bets/calculations";
import { selectCarryOvers, type ResultReport } from "@/lib/bets/results-carryover";

/**
 * Plays owed to `recipient` in the results email for `resultsDate`: ones
 * they were sent as Open that have been graded since. See selectCarryOvers.
 */
export async function loadCarryOvers(
  db: SupabaseClient,
  recipient: string,
  resultsDate: string,
): Promise<BetEntryComputed[]> {
  const email = recipient.toLowerCase();

  const open = await db
    .from("bet_result_reports")
    .select("bet_entry_id")
    .eq("recipient_email", email)
    .eq("reported_status", "Open");

  if (open.error) throw new Error(open.error.message);

  const ids = [...new Set((open.data ?? []).map((row) => row.bet_entry_id as string))];
  if (ids.length === 0) return [];

  const [reports, plays] = await Promise.all([
    db
      .from("bet_result_reports")
      .select("bet_entry_id, results_date, reported_status, reported_at")
      .eq("recipient_email", email)
      .in("bet_entry_id", ids),
    db.from("bet_entries").select("*, sports(abbreviation, full_name)").in("id", ids),
  ]);

  if (reports.error) throw new Error(reports.error.message);
  if (plays.error) throw new Error(plays.error.message);

  return selectCarryOvers(
    (reports.data ?? []) as ResultReport[],
    ((plays.data ?? []) as BetEntryRow[]).map((row) => withComputedFields(row)),
    resultsDate,
  );
}

/**
 * Records what `recipients` were just told about each play in a results
 * email, so a play they saw as Open is owed to them until it is reported
 * graded. Sending the same date twice keeps the latest status.
 */
export async function recordResultReports(
  db: SupabaseClient,
  recipients: string[],
  resultsDate: string,
  plays: BetEntryComputed[],
) {
  const rows = recipients.flatMap((recipient) =>
    plays.map((play) => ({
      bet_entry_id: play.id,
      recipient_email: recipient.toLowerCase(),
      results_date: resultsDate,
      reported_status: play.status,
      reported_at: new Date().toISOString(),
    })),
  );

  if (rows.length === 0) return;

  const { error } = await db
    .from("bet_result_reports")
    .upsert(rows, { onConflict: "bet_entry_id,recipient_email,results_date" });

  if (error) throw new Error(error.message);
}
