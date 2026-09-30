import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeDailyPlSeries,
  getPreviousWeekRange,
  getRollingWeekRange,
  withComputedFields,
  type BetEntryRow,
} from "@/lib/bets/calculations";
import type { WeekInReviewEmailParams } from "@/lib/email/week-in-review";
import type { Sport } from "@/lib/sports/types";

/**
 * Everything the week in review email needs, for either range. Shared by the
 * manual send and the scheduled one so the two cannot drift apart.
 *
 * Rolling is the seven days ending yesterday; otherwise the last completed
 * Monday–Sunday week.
 */
export async function loadWeekInReview(
  client: SupabaseClient,
  { rolling }: { rolling: boolean },
): Promise<WeekInReviewEmailParams> {
  const { weekStart, weekEnd } = rolling ? getRollingWeekRange() : getPreviousWeekRange();

  const [entriesResult, sportsResult] = await Promise.all([
    client
      .from("bet_entries")
      .select("*, sports(abbreviation, full_name)")
      .gte("event_date", weekStart)
      .lte("event_date", weekEnd)
      .order("event_date", { ascending: true }),
    client.from("sports").select("*").order("sort_order"),
  ]);

  if (entriesResult.error || sportsResult.error) {
    throw new Error(entriesResult.error?.message ?? sportsResult.error?.message);
  }

  const entries = (entriesResult.data as BetEntryRow[]).map(withComputedFields);

  return {
    entries,
    sports: (sportsResult.data ?? []) as Sport[],
    weekStart,
    weekEnd,
    series: computeDailyPlSeries(entries, weekStart, weekEnd),
    viewLabel: rolling ? "Rolling 7 days to yesterday" : "Last Monday – Sunday",
  };
}
