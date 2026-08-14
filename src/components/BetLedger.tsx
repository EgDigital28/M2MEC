"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  BET_STATUSES,
  formatEventDate,
  formatMoney,
  formatOdds,
  type BetEntryComputed,
  type BetStatus,
} from "@/lib/bets/calculations";

import type { Sport } from "@/lib/sports/types";

type BetLedgerProps = {
  isAdmin: boolean;
};

const emptyForm = {
  event_date: new Date().toISOString().slice(0, 10),
  sport_id: "",
  event_name: "",
  line: "",
  risk: "",
};

export function BetLedger({ isAdmin }: BetLedgerProps) {
  const [entries, setEntries] = useState<BetEntryComputed[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [entriesResponse, sportsResponse] = await Promise.all([
        fetch("/api/bets"),
        fetch("/api/sports?active=true"),
      ]);

      const entriesData = (await entriesResponse.json()) as {
        entries?: BetEntryComputed[];
        error?: string;
      };
      const sportsData = (await sportsResponse.json()) as {
        sports?: Sport[];
        error?: string;
      };

      if (!entriesResponse.ok) {
        setError(entriesData.error ?? "Could not load entries.");
        setLoading(false);
        return;
      }

      if (!sportsResponse.ok) {
        setError(sportsData.error ?? "Could not load sports.");
        setLoading(false);
        return;
      }

      setEntries(entriesData.entries ?? []);
      setSports(sportsData.sports ?? []);
    } catch {
      setError("Network error while loading entries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const totalProfitLoss = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.profit_loss, 0),
    [entries],
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as {
        entry?: BetEntryComputed;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Could not create entry.");
        setSubmitting(false);
        return;
      }

      if (data.entry) {
        setEntries((current) => [data.entry!, ...current]);
      }

      setForm({ ...emptyForm, event_date: form.event_date, sport_id: form.sport_id });
    } catch {
      setError("Network error while creating entry.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: string, status: BetStatus) {
    setError(null);

    try {
      const response = await fetch(`/api/bets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = (await response.json()) as {
        entry?: BetEntryComputed;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Could not update entry.");
        return;
      }

      if (data.entry) {
        setEntries((current) =>
          current.map((entry) => (entry.id === id ? data.entry! : entry)),
        );
      }
    } catch {
      setError("Network error while updating entry.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/bets/${id}`, { method: "DELETE" });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Could not delete entry.");
        return;
      }

      setEntries((current) => current.filter((entry) => entry.id !== id));
    } catch {
      setError("Network error while deleting entry.");
    }
  }

  return (
    <div className="space-y-8">
      {isAdmin && (
        <section className="rounded-2xl border border-border bg-surface-elevated p-6">
          <h2 className="text-lg font-semibold">New entry</h2>
          <p className="mt-1 text-sm text-muted">
            Enter the event details. To Win and P/L are calculated automatically.
          </p>

          <form
            onSubmit={handleCreate}
            className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5"
          >
            <div>
              <label htmlFor="event_date" className="mb-1.5 block text-sm font-medium">
                Date
              </label>
              <input
                id="event_date"
                type="date"
                required
                value={form.event_date}
                onChange={(event) =>
                  setForm((current) => ({ ...current, event_date: event.target.value }))
                }
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>

            <div>
              <label htmlFor="sport_id" className="mb-1.5 block text-sm font-medium">
                Sport
              </label>
              <select
                id="sport_id"
                required
                value={form.sport_id}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sport_id: event.target.value }))
                }
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
              >
                <option value="" disabled>
                  Select sport
                </option>
                {sports.map((sport) => (
                  <option key={sport.id} value={sport.id}>
                    {sport.abbreviation} — {sport.full_name}
                  </option>
                ))}
              </select>
              {sports.length === 0 && (
                <p className="mt-2 text-xs text-muted">
                  No active sports.{" "}
                  {isAdmin ? (
                    <a href="/team/sports" className="text-accent hover:underline">
                      Configure sports
                    </a>
                  ) : (
                    "Ask an admin to configure sports."
                  )}
                </p>
              )}
            </div>

            <div className="md:col-span-2 xl:col-span-1">
              <label htmlFor="event_name" className="mb-1.5 block text-sm font-medium">
                Event
              </label>
              <input
                id="event_name"
                required
                value={form.event_name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, event_name: event.target.value }))
                }
                placeholder="Mets ML"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>

            <div>
              <label htmlFor="line" className="mb-1.5 block text-sm font-medium">
                Line
              </label>
              <input
                id="line"
                type="number"
                required
                step="1"
                value={form.line}
                onChange={(event) =>
                  setForm((current) => ({ ...current, line: event.target.value }))
                }
                placeholder="-110"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>

            <div>
              <label htmlFor="risk" className="mb-1.5 block text-sm font-medium">
                Risk
              </label>
              <input
                id="risk"
                type="number"
                required
                min="0.1"
                step="0.1"
                value={form.risk}
                onChange={(event) =>
                  setForm((current) => ({ ...current, risk: event.target.value }))
                }
                placeholder="11.0"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>

            <div className="md:col-span-2 xl:col-span-5">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Adding..." : "Add entry"}
              </button>
            </div>
          </form>
        </section>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-emerald-900/80 text-left text-white">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Sport</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Line</th>
                <th className="px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3 font-medium">To Win</th>
                <th className="px-4 py-3 font-medium">Win/Loss</th>
                <th className="px-4 py-3 font-medium">P/L</th>
                {isAdmin && <th className="px-4 py-3 font-medium" />}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-4 py-8 text-center text-muted">
                    Loading entries...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-4 py-8 text-center text-muted">
                    No entries yet.
                  </td>
                </tr>
              ) : (
                entries.map((entry, index) => (
                  <tr
                    key={entry.id}
                    className={index % 2 === 0 ? "bg-surface" : "bg-surface-elevated/40"}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatEventDate(entry.event_date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{entry.sport}</td>
                    <td className="px-4 py-3">{entry.event_name}</td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">
                      {formatOdds(entry.line)}
                    </td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">
                      {formatMoney(entry.risk)}
                    </td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">
                      {formatMoney(entry.to_win)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isAdmin ? (
                        <select
                          value={entry.status}
                          onChange={(event) =>
                            handleStatusChange(entry.id, event.target.value as BetStatus)
                          }
                          className="rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
                        >
                          {BET_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      ) : (
                        entry.status
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 font-mono whitespace-nowrap ${
                        entry.profit_loss > 0
                          ? "text-emerald-400"
                          : entry.profit_loss < 0
                            ? "text-red-400"
                            : "text-muted"
                      }`}
                    >
                      {formatMoney(entry.profit_loss)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          className="text-xs text-red-300 transition-colors hover:text-red-200"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {entries.length > 0 && (
              <tfoot className="border-t border-border bg-surface-elevated">
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-right font-medium">
                    Total P/L
                  </td>
                  <td
                    className={`px-4 py-3 font-mono font-semibold ${
                      totalProfitLoss > 0
                        ? "text-emerald-400"
                        : totalProfitLoss < 0
                          ? "text-red-400"
                          : "text-muted"
                    }`}
                  >
                    {formatMoney(totalProfitLoss)}
                  </td>
                  {isAdmin && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
