"use client";

import { useState } from "react";
import type { AutomatedEmailType } from "@/lib/email/automation";

export type AutomationCard = {
  type: AutomatedEmailType;
  enabled: boolean;
  updatedAt: string | null;
  label: string;
  schedule: string;
  rule: string;
  recipients: {
    email: string;
    lastSentAt: string | null;
    lastSentAutomated: boolean;
    pending: { newCount: number; isFirst: boolean } | null;
  }[];
};

function formatEastern(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      }).format(date) + " ET"
    : "—";
}

function pendingText(
  pending: NonNullable<AutomationCard["recipients"][number]["pending"]>,
  enabled: boolean,
) {
  if (!enabled) {
    return pending.newCount === 0
      ? "Switched off · nothing new either"
      : `Switched off · ${pending.newCount} ${pending.newCount === 1 ? "play" : "plays"} would be new`;
  }
  if (pending.newCount === 0) return "Nothing new — the next check would send nothing";
  const plays = `${pending.newCount} ${pending.newCount === 1 ? "play" : "plays"}`;
  return pending.isFirst
    ? `Next check would send today's first email (${plays})`
    : `Next check would send an update (${plays} new)`;
}

export function EmailAutomationPanel({
  initialCards,
  loadError,
}: {
  initialCards: AutomationCard[];
  loadError: string | null;
}) {
  const [cards, setCards] = useState(initialCards);
  const [saving, setSaving] = useState<AutomatedEmailType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(card: AutomationCard) {
    setSaving(card.type);
    setError(null);

    try {
      const response = await fetch("/api/email-automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailType: card.type, enabled: !card.enabled }),
      });
      const data = (await response.json()) as { enabled?: boolean; updatedAt?: string; error?: string };

      if (!response.ok || typeof data.enabled !== "boolean") {
        setError(data.error ?? "Could not save the switch.");
        return;
      }

      setCards((current) =>
        current.map((entry) =>
          entry.type === card.type
            ? { ...entry, enabled: data.enabled as boolean, updatedAt: data.updatedAt ?? null }
            : entry,
        ),
      );
    } catch {
      setError("Network error while saving the switch.");
    } finally {
      setSaving(null);
    }
  }

  if (loadError) {
    return (
      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">{loadError}</p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="rounded-lg border border-red-400/30 p-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {cards.map((card) => (
        <section key={card.type} className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">{card.label}</h2>
              <p className="mt-1 text-sm text-muted">{card.schedule}</p>
              <p className="mt-2 max-w-2xl text-sm text-muted">{card.rule}</p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={card.enabled}
              aria-label={`${card.label} ${card.enabled ? "on" : "off"}`}
              onClick={() => toggle(card)}
              disabled={saving !== null}
              className="flex items-center gap-3 disabled:opacity-60"
            >
              <span className={`text-sm font-medium ${card.enabled ? "text-foreground" : "text-muted"}`}>
                {saving === card.type ? "Saving…" : card.enabled ? "On" : "Off"}
              </span>
              <span
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  card.enabled ? "bg-accent" : "bg-surface-elevated ring-1 ring-border"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                    card.enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </span>
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-120 text-sm">
              <thead className="text-left text-[10px] uppercase tracking-widest text-muted">
                <tr>
                  <th className="pb-2 pr-4 font-semibold">Recipient</th>
                  <th className="pb-2 pr-4 font-semibold">Last sent</th>
                  {card.type === "upcoming_plays" ? (
                    <th className="pb-2 font-semibold">Right now</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {card.recipients.map((recipient, index) => (
                  <tr key={recipient.email} className="border-t border-border">
                    <td className="py-2 pr-4">{recipient.email}</td>
                    <td className="py-2 pr-4 text-muted">
                      {recipient.lastSentAt
                        ? `${formatEastern(recipient.lastSentAt)} · ${recipient.lastSentAutomated ? "scheduled" : "manual"}`
                        : "Never"}
                    </td>
                    {recipient.pending ? (
                      <td className="py-2 text-muted">
                        {pendingText(recipient.pending, card.enabled)} ·{" "}
                        <a
                          href={`/api/email-automation/preview?recipient=${index}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent underline-offset-4 hover:underline"
                        >
                          Preview
                        </a>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {card.updatedAt ? (
            <p className="mt-3 text-xs text-muted">Switch last changed {formatEastern(card.updatedAt)}</p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
