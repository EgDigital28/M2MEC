"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  BET_EMAIL_TYPE_LABELS,
  mapLedgerEmailAction,
  type BetEmailSendBatch,
  type BetEmailType,
} from "@/lib/bets/email-sends-types";

type BetLedgerEmailActionsProps = {
  entries: BetEntryComputed[];
};

type LedgerEmailAction = "upcoming" | "yesterday" | "weekly";

const fieldClassName =
  "h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent";

const primaryButtonClassName =
  "rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClassName =
  "rounded-full border border-border bg-surface-elevated px-5 py-2.5 text-sm font-semibold text-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

function formatSentTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function duplicateConfirmMessage(emailType: BetEmailType, duplicates: { email: string; sentAt: string }[]) {
  const label = BET_EMAIL_TYPE_LABELS[emailType];
  const lines = duplicates.map(
    (duplicate) => `- ${duplicate.email} (${formatSentTime(duplicate.sentAt)})`,
  );

  return `${label} was already sent today to:\n${lines.join("\n")}\n\nSend again anyway?`;
}

export function BetLedgerEmailActions({ entries }: BetLedgerEmailActionsProps) {
  const [to, setTo] = useState("");
  const [sendingAction, setSendingAction] = useState<LedgerEmailAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [history, setHistory] = useState<BetEmailSendBatch[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [migrationRequired, setMigrationRequired] = useState(false);

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

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);

    try {
      const response = await fetch("/api/bets/email/history");
      const data = (await response.json()) as {
        history?: BetEmailSendBatch[];
        error?: string;
      };

      if (!response.ok) {
        if (response.status === 503) {
          setMigrationRequired(true);
        }
        setHistory([]);
        setHistoryLoading(false);
        return;
      }

      setHistory(data.history ?? []);
      setMigrationRequired(false);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function checkDuplicates(action: LedgerEmailAction) {
    const emailType = mapLedgerEmailAction(action);
    const params = new URLSearchParams({
      type: emailType,
      to: to.trim(),
    });
    const response = await fetch(`/api/bets/email/duplicates?${params.toString()}`);
    const data = (await response.json()) as {
      duplicates?: { email: string; sentAt: string }[];
      error?: string;
    };

    if (!response.ok) {
      return [];
    }

    return data.duplicates ?? [];
  }

  async function sendEmail(
    action: LedgerEmailAction,
    endpoint: string,
    successMessage: (data: { playCount?: number; recipientCount?: number }) => string,
  ) {
    setSendingAction(action);
    setError(null);
    setSuccess(null);

    try {
      const duplicates = await checkDuplicates(action);

      if (duplicates.length > 0) {
        const confirmed = window.confirm(
          duplicateConfirmMessage(mapLedgerEmailAction(action), duplicates),
        );

        if (!confirmed) {
          setSendingAction(null);
          return;
        }
      }

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
      void loadHistory();
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
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface-elevated p-5">
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
      </div>

      <div className="rounded-2xl border border-border bg-surface-elevated p-5">
        <h3 className="text-sm font-semibold">Send history</h3>
        <p className="mt-1 text-xs text-muted">
          Recent ledger emails by type, recipient, and time. Resending the same type to a recipient
          today will prompt a warning.
        </p>

        {migrationRequired && (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Run <code className="text-foreground">018_bet_email_sends.sql</code> in Supabase to
            enable send history and duplicate warnings.
          </p>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-muted">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">To</th>
                  <th className="px-4 py-3 font-medium">Sent</th>
                  <th className="px-4 py-3 font-medium text-right">Plays</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted">
                      Loading send history...
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted">
                      No emails sent yet.
                    </td>
                  </tr>
                ) : (
                  history.map((batch) => (
                    <tr key={batch.batch_id} className="border-b border-border/60">
                      <td className="px-4 py-3 font-medium">
                        {BET_EMAIL_TYPE_LABELS[batch.email_type]}
                      </td>
                      <td className="px-4 py-3 text-muted">{batch.recipients.join(", ")}</td>
                      <td className="px-4 py-3 text-muted">{formatSentTime(batch.sent_at)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {batch.play_count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
