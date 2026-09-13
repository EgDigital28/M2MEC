import {
  getTodayDateString,
  getYesterdayDateString,
  withComputedFields,
  type BetEntryComputed,
  type BetEntryRow,
} from "@/lib/bets/calculations";
import { tryCreateAdminClient } from "@/lib/supabase/admin";

const BET_SELECT = "*, sports(abbreviation, full_name)";

export async function fetchYesterdaysResults(): Promise<{
  resultsDate: string;
  entries: BetEntryComputed[];
}> {
  const admin = tryCreateAdminClient();

  if (!admin) {
    throw new Error("service_role_unconfigured");
  }

  const resultsDate = getYesterdayDateString();
  const { data, error } = await admin
    .from("bet_entries")
    .select(BET_SELECT)
    .eq("event_date", resultsDate)
    .order("sport_id", { ascending: true })
    .order("event_name", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return {
    resultsDate,
    entries: (data as BetEntryRow[]).map((row) => withComputedFields(row)),
  };
}

export async function fetchUpcomingPlays(): Promise<BetEntryComputed[]> {
  const admin = tryCreateAdminClient();

  if (!admin) {
    throw new Error("service_role_unconfigured");
  }

  const today = getTodayDateString();
  const { data, error } = await admin
    .from("bet_entries")
    .select(BET_SELECT)
    .eq("status", "Open")
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as BetEntryRow[]).map((row) => withComputedFields(row));
}
