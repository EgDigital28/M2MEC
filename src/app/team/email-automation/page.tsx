import { notFound } from "next/navigation";
import { EmailAutomationPanel, type AutomationCard } from "@/components/EmailAutomationPanel";
import { requireMinimumTier } from "@/lib/auth/profile";
import { getTodayDateString } from "@/lib/bets/calculations";
import { buildTodaysPlaysDigests } from "@/lib/bets/todays-plays-digest";
import {
  AUTOMATED_EMAILS,
  AUTOMATED_RECIPIENTS,
  loadAutomationSettings,
  type AutomatedEmailType,
} from "@/lib/email/automation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Latest send of each automated type to each recipient, manual or scheduled. */
async function lastSends(db: ReturnType<typeof createAdminClient>) {
  const { data, error } = await db
    .from("bet_email_sends")
    .select("email_type, recipient_email, sent_at, is_automated")
    .in("email_type", Object.keys(AUTOMATED_EMAILS))
    .order("sent_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  const latest = new Map<string, { sentAt: string; automated: boolean }>();
  for (const row of data ?? []) {
    const key = `${row.email_type}|${String(row.recipient_email).toLowerCase()}`;
    if (!latest.has(key)) latest.set(key, { sentAt: row.sent_at, automated: Boolean(row.is_automated) });
  }
  return latest;
}

export default async function EmailAutomationPage() {
  const auth = await requireMinimumTier("admin");

  // Admin-only, and invisible rather than forbidden to everyone else.
  if ("error" in auth) {
    notFound();
  }

  const db = createAdminClient();
  let cards: AutomationCard[] = [];
  let loadError: string | null = null;

  try {
    const today = getTodayDateString();
    const [settings, sends, digests] = await Promise.all([
      loadAutomationSettings(db),
      lastSends(db),
      buildTodaysPlaysDigests(db, AUTOMATED_RECIPIENTS, today),
    ]);

    cards = settings.map(({ type, enabled, updatedAt }) => ({
      type,
      enabled,
      updatedAt,
      label: AUTOMATED_EMAILS[type as AutomatedEmailType].label,
      schedule: AUTOMATED_EMAILS[type as AutomatedEmailType].schedule,
      rule: AUTOMATED_EMAILS[type as AutomatedEmailType].rule,
      recipients: AUTOMATED_RECIPIENTS.map((email) => {
        const last = sends.get(`${type}|${email.toLowerCase()}`) ?? null;
        const digest = digests.find((entry) => entry.recipient === email);

        return {
          email,
          lastSentAt: last?.sentAt ?? null,
          lastSentAutomated: last?.automated ?? false,
          // Only today's plays has a "what would go out next" view.
          pending:
            type === "upcoming_plays" && digest
              ? { newCount: digest.newPlays.length, isFirst: digest.isFirst }
              : null,
        };
      }),
    }));
  } catch (error) {
    console.error("email-automation.load_failed", error);
    loadError =
      error instanceof Error && /email_automation_settings/.test(error.message)
        ? "The switches are not set up yet. Run 037_email_automation_settings.sql in Supabase."
        : "Email automation could not be loaded.";
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">Admin</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Email automation</h1>
        <p className="mt-2 text-sm text-muted">
          Emails that send on a schedule. Switching one off stops it at its next check; switching
          it back on picks up where it left off. All times are Eastern.
        </p>
      </section>

      <EmailAutomationPanel initialCards={cards} loadError={loadError} />
    </div>
  );
}
