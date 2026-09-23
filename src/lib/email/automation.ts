import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Everyone who receives the automated emails. Each address gets its own
 * email, so recipients never see one another. Kept in code for now; moving it
 * into the app is a later step.
 */
export const AUTOMATED_RECIPIENTS = ["eli.goshert@gmail.com", "samueltbennettsr@gmail.com"];

/** Operational notices, such as a skipped results email, stay internal. */
export const AUTOMATION_ALERT_RECIPIENTS = ["eli.goshert@gmail.com"];

/**
 * Every scheduled email, described for the Email automation page. The key is
 * the type recorded in the send history.
 */
export const AUTOMATED_EMAILS = {
  yesterdays_results: {
    label: "Yesterday's results",
    schedule: "1am, 2am and 3am Eastern",
    rule: "Waits until all of yesterday's plays are graded. If any are still open after 3am, you get an alert instead.",
    /** It was already sending before the switch existed. */
    defaultEnabled: true,
  },
  upcoming_plays: {
    label: "Today's plays",
    schedule: "11am, 2pm, 4pm, 7pm and 9pm Eastern",
    rule: "Sends only when new plays have arrived since that person's last email. Updates highlight the new plays above the ones sent earlier.",
    defaultEnabled: false,
  },
} as const;

export type AutomatedEmailType = keyof typeof AUTOMATED_EMAILS;

export function isAutomatedEmailType(value: unknown): value is AutomatedEmailType {
  return typeof value === "string" && value in AUTOMATED_EMAILS;
}

/**
 * Current switch positions. A type with no row falls back to its default. A
 * failed lookup throws: the scheduled job then stands down for that run rather
 * than guessing whether it is allowed to send.
 */
export async function loadAutomationSettings(db: SupabaseClient) {
  const { data, error } = await db
    .from("email_automation_settings")
    .select("email_type, enabled, updated_at");

  if (error) throw new Error(error.message);

  const rows = new Map((data ?? []).map((row) => [row.email_type as string, row]));

  return (Object.keys(AUTOMATED_EMAILS) as AutomatedEmailType[]).map((type) => ({
    type,
    enabled: (rows.get(type)?.enabled as boolean | undefined) ?? AUTOMATED_EMAILS[type].defaultEnabled,
    updatedAt: (rows.get(type)?.updated_at as string | undefined) ?? null,
  }));
}

export async function isAutomationEnabled(db: SupabaseClient, type: AutomatedEmailType) {
  const settings = await loadAutomationSettings(db);
  return settings.find((setting) => setting.type === type)?.enabled ?? false;
}
