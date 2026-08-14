"use client";

import { useMemo, useState } from "react";
import {
  filterEntriesByEventDate,
  filterEntriesByEventDateRange,
  filterOpenPlaysTodayAndUpcoming,
  formatEventDate,
  formatWeekRangeShort,
  getCurrentWeekRange,
  getYesterdayDateString,
  type BetEntryComputed,
} from "@/lib/bets/calculations";

type BetLedgerEmailActionsProps = {
  entries: BetEntryComputed[];
};

const fieldClassName =
  "h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent";

const primaryButtonClassName =
  "rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClassName =
  "rounded-full border border-border bg-surface-elevated px-5 py-2.5 text-sm font-semibold text-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

export function BetLedgerEmailActions({ entries }: BetLedgerEmailActionsProps) {
  const [to, setTo] = useState("");
  const [sendingAction, setSendingAction] = useState<"upcoming" | "yesterday" | "weekly" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const openPlays = useMemo(
    () => filterOpenPlaysTodayAndUpcoming(entries),
    [entries],
  );

  const yesterdayDate = useMemo(() => getYesterdayDateString(), []);
  const yesterdayPlays = useMemo(
    () => filterEntriesByEventDate(entries, yesterdayDate),
    [entries, yesterdayDate],
  );

  const weekRange = useMemo(() => getCurrentWeekRange(), []);
  const weekPlays = useMemo(
    () => filterEntriesByEventDateRange(entries, weekRange.weekStart, weekRange.weekEnd),
    [entries, weekRange],
  );

  async function sendEmail(
    action: "upcoming" | "yesterday" | "weekly",
    endpoint: string,
    successMessage: (data: { playCount?: number; recipientCount?: number }) => string,
  ) {
    setSendingAction(action);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        recipientCount?: number;
        playCount?: number;
      };

      if (!response.ok) {
        setError(data.error ?? "Could not send email.");
        setSendingAction(null);
        return;
      }

      setSuccess(successMessage(data));
    } catch {
      setError("Network error while sending email.");
    } finally {
      setSendingAction(null);
    }
  }

  function sendUpcomingPlays() {
    return sendEmail("upcoming", "/api/bets/email/todays-plays", (data) =>
      `Sent upcoming plays (${data.playCount ?? openPlays.length} open) to ${data.recipientCount ?? 0} recipient(s).`,
    );
  }

  function sendYesterdaysResults() {
    return sendEmail("yesterday", "/api/bets/email/yesterdays-results", (data) =>
      `Sent yesterday's results (${data.playCount ?? yesterdayPlays.length} plays) to ${data.recipientCount ?? 0} recipient(s).`,
    );
  }

  function sendWeeklySummary() {
    return sendEmail("weekly", "/api/bets/email/weekly-summary", (data) =>
      `Sent weekly summary (${data.playCount ?? weekPlays.length} plays) to ${data.recipientCount ?? 0} recipient(s).`,
    );
  }

  const sending = sendingAction !== null;

  return (
    <section className="rounded-2xl border border-border bg-surface-elevated p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <label htmlFor="bet-email-to" className="text-xs font-medium uppercase tracking-widest text-muted">
            To
          </label>
          <input
            id="bet-email-to"
            type="text"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="email@example.com, another@example.com"
            className={`${fieldClassName} mt-2`}
          />
          <p className="mt-2 text-xs text-muted">
            Comma-separated recipients. {openPlays.length} upcoming open{" "}
            {openPlays.length === 1 ? "play" : "plays"} · {yesterdayPlays.length}{" "}
            {yesterdayPlays.length === 1 ? "play" : "plays"} yesterday (
            {formatEventDate(yesterdayDate)}) · {weekPlays.length}{" "}
            {weekPlays.length === 1 ? "play" : "plays"} this week (
            {formatWeekRangeShort(weekRange.weekStart, weekRange.weekEnd)}).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={sendUpcomingPlays}
            disabled={sending || !to.trim()}
            className={primaryButtonClassName}
          >
            {sendingAction === "upcoming" ? "Sending..." : "Send upcoming plays"}
          </button>
          <button
            type="button"
            onClick={sendYesterdaysResults}
            disabled={sending || !to.trim()}
            className={secondaryButtonClassName}
          >
            {sendingAction === "yesterday" ? "Sending..." : "Yesterday\u2019s results"}
          </button>
          <button
            type="button"
            onClick={sendWeeklySummary}
            disabled={sending || !to.trim()}
            className={secondaryButtonClassName}
          >
            {sendingAction === "weekly" ? "Sending..." : "Weekly summary"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {success && (
        <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </p>
      )}
    </section>
  );
}
