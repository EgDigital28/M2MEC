"use client";

import { useMemo, useState } from "react";
import {
  filterOpenPlaysTodayAndUpcoming,
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
  "rounded-full border border-border bg-surface-elevated px-5 py-2.5 text-sm font-semibold text-muted transition-opacity disabled:cursor-not-allowed disabled:opacity-60";

export function BetLedgerEmailActions({ entries }: BetLedgerEmailActionsProps) {
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const openPlays = useMemo(
    () => filterOpenPlaysTodayAndUpcoming(entries),
    [entries],
  );

  async function sendTodaysPlays() {
    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/bets/email/todays-plays", {
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
        setSending(false);
        return;
      }

      setSuccess(
        `Sent today's plays (${data.playCount ?? openPlays.length} open) to ${data.recipientCount ?? 0} recipient(s).`,
      );
    } catch {
      setError("Network error while sending email.");
    } finally {
      setSending(false);
    }
  }

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
            Comma-separated recipients. {openPlays.length} open{" "}
            {openPlays.length === 1 ? "play" : "plays"} for today and upcoming.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={sendTodaysPlays}
            disabled={sending || !to.trim()}
            className={primaryButtonClassName}
          >
            {sending ? "Sending..." : "Send today's plays"}
          </button>
          <button type="button" disabled className={secondaryButtonClassName} title="Coming soon">
            {"Yesterday's results"}
          </button>
          <button type="button" disabled className={secondaryButtonClassName} title="Coming soon">
            Weekly summary
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
