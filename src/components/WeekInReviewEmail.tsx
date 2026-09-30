"use client";

import { useState, type FormEvent } from "react";
import { BET_EMAIL_TYPE_LABELS } from "@/lib/bets/email-sends-types";

type WeekInReviewEmailProps = {
  view: "rolling" | "week";
};

function formatSentTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/New_York",
      }).format(date)
    : "earlier";
}

export function WeekInReviewEmail({ view }: WeekInReviewEmailProps) {
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      // Same duplicate guard the ledger emails use, so a second send today is
      // deliberate rather than accidental.
      const params = new URLSearchParams({ type: "week_in_review", to });
      const check = await fetch(`/api/bets/email/duplicates?${params.toString()}`);
      const checkData = (await check.json()) as {
        duplicates?: { email: string; sentAt: string }[];
        error?: string;
      };

      if (check.ok && checkData.duplicates?.length) {
        const lines = checkData.duplicates
          .map((duplicate) => `- ${duplicate.email} (${formatSentTime(duplicate.sentAt)})`)
          .join("\n");

        if (
          !window.confirm(
            `${BET_EMAIL_TYPE_LABELS.week_in_review} already went out today to:\n\n${lines}\n\nSend again?`,
          )
        ) {
          setBusy(false);
          return;
        }
      }

      const response = await fetch("/api/bets/email/week-in-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, view }),
      });

      const data = (await response.json()) as {
        recipientCount?: number;
        playCount?: number;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Could not send the email.");
        return;
      }

      setStatus(
        `Sent ${data.playCount ?? 0} ${data.playCount === 1 ? "play" : "plays"} to ${
          data.recipientCount ?? 0
        } recipient(s).`,
      );
      setTo("");
    } catch {
      setError("Network error while sending the email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <form onSubmit={send} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1">
          <label
            htmlFor="week-review-to"
            className="text-[10px] font-semibold uppercase tracking-widest text-muted"
          >
            Email this view
          </label>
          <input
            id="week-review-to"
            type="text"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            required
            placeholder="email@example.com, another@example.com"
            className="mt-2 w-full rounded-lg border border-border bg-background p-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          disabled={busy || to.trim().length === 0}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
        >
          {busy ? "Sending..." : "Send email"}
        </button>
      </form>

      <p className="mt-2 text-xs text-muted">
        Comma-separated recipients. Sends the range currently shown.
      </p>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-red-400/30 p-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {status ? (
        <p className="mt-3 rounded-lg border border-emerald-400/30 p-3 text-sm text-emerald-300">
          {status}
        </p>
      ) : null}
    </div>
  );
}
