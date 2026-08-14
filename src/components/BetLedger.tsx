"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  BET_STATUSES,
  formatCurrency,
  formatEventDate,
  formatOdds,
  type BetEntryComputed,
  type BetStatus,
} from "@/lib/bets/calculations";
import type { Sport } from "@/lib/sports/types";

type BetLedgerProps = {
  isAdmin: boolean;
};

type EntryForm = {
  event_date: string;
  sport_id: string;
  event_name: string;
  line: string;
  risk: string;
  status: BetStatus;
};

const emptyForm: EntryForm = {
  event_date: new Date().toISOString().slice(0, 10),
  sport_id: "",
  event_name: "",
  line: "",
  risk: "",
  status: "Open",
};

function sanitizeLineInput(value: string) {
  if (value === "" || value === "-") {
    return value;
  }

  const match = value.match(/^-?\d*/);
  return match?.[0] ?? "";
}

function sanitizeRiskInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  const decimals = rest.join("").slice(0, 2);
  return decimals.length > 0 ? `${whole}.${decimals}` : whole;
}

function entryToForm(entry: BetEntryComputed): EntryForm {
  return {
    event_date: entry.event_date,
    sport_id: entry.sport_id,
    event_name: entry.event_name,
    line: String(Math.trunc(entry.line)),
    risk: entry.risk.toFixed(2),
    status: entry.status,
  };
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path
        fillRule="evenodd"
        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function BetLedger({ isAdmin }: BetLedgerProps) {
  const [entries, setEntries] = useState<BetEntryComputed[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EntryForm>(emptyForm);

  const activeSports = useMemo(
    () => sports.filter((sport) => sport.is_active),
    [sports],
  );

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [entriesResponse, sportsResponse] = await Promise.all([
        fetch("/api/bets"),
        fetch("/api/sports"),
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
        body: JSON.stringify({
          event_date: form.event_date,
          sport_id: form.sport_id,
          event_name: form.event_name,
          line: Number.parseInt(form.line, 10),
          risk: Number.parseFloat(form.risk).toFixed(2),
        }),
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

      setForm({
        ...emptyForm,
        event_date: form.event_date,
        sport_id: form.sport_id,
      });
    } catch {
      setError("Network error while creating entry.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(entry: BetEntryComputed) {
    setEditingId(entry.id);
    setEditForm(entryToForm(entry));
  }

  async function handleSaveEdit(id: string) {
    setError(null);

    const line = Number.parseInt(editForm.line, 10);
    const risk = Number.parseFloat(editForm.risk);

    if (Number.isNaN(line) || line === 0) {
      setError("Line must be a non-zero whole number.");
      return;
    }

    if (Number.isNaN(risk) || risk <= 0) {
      setError("Risk must be greater than zero.");
      return;
    }

    try {
      const response = await fetch(`/api/bets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_date: editForm.event_date,
          sport_id: editForm.sport_id,
          event_name: editForm.event_name,
          line,
          risk,
          status: editForm.status,
        }),
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

      setEditingId(null);
    } catch {
      setError("Network error while updating entry.");
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
      if (editingId === id) {
        setEditingId(null);
      }
    } catch {
      setError("Network error while deleting entry.");
    }
  }

  const inputClassName =
    "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent";

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
            className="mt-6 grid gap-4 md:grid-cols-6 xl:grid-cols-12"
          >
            <div className="md:col-span-2 xl:col-span-2">
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
                className={inputClassName}
              />
            </div>

            <div className="md:col-span-2 xl:col-span-3">
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
                className={inputClassName}
              >
                <option value="" disabled>
                  Select sport
                </option>
                {activeSports.map((sport) => (
                  <option key={sport.id} value={sport.id}>
                    {sport.abbreviation} — {sport.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-6 xl:col-span-4">
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
                placeholder="Ben Shelton ML"
                className={inputClassName}
              />
            </div>

            <div className="md:col-span-1 xl:col-span-1">
              <label htmlFor="line" className="mb-1.5 block text-sm font-medium">
                Line
              </label>
              <input
                id="line"
                inputMode="numeric"
                required
                value={form.line}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    line: sanitizeLineInput(event.target.value),
                  }))
                }
                placeholder="-110"
                className={`${inputClassName} font-mono`}
              />
            </div>

            <div className="md:col-span-1 xl:col-span-2">
              <label htmlFor="risk" className="mb-1.5 block text-sm font-medium">
                Risk
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
                  $
                </span>
                <input
                  id="risk"
                  inputMode="decimal"
                  required
                  value={form.risk}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      risk: sanitizeRiskInput(event.target.value),
                    }))
                  }
                  placeholder="11.00"
                  className={`${inputClassName} pl-7 font-mono`}
                />
              </div>
            </div>

            <div className="md:col-span-6 xl:col-span-12">
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
            <thead className="border-b border-border bg-surface-elevated text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-muted">Date</th>
                <th className="px-4 py-3 font-medium text-muted">Sport</th>
                <th className="px-4 py-3 font-medium text-muted">Event</th>
                <th className="px-4 py-3 font-medium text-muted">Line</th>
                <th className="px-4 py-3 font-medium text-muted text-right">Risk</th>
                <th className="px-4 py-3 font-medium text-muted text-right">To Win</th>
                <th className="px-4 py-3 font-medium text-muted">Win/Loss</th>
                <th className="px-4 py-3 font-medium text-muted text-right">P/L</th>
                {isAdmin && (
                  <th className="px-4 py-3 font-medium text-muted text-right">Actions</th>
                )}
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
                entries.map((entry, index) => {
                  const isEditing = editingId === entry.id;

                  return (
                    <tr
                      key={entry.id}
                      className={`border-t border-border ${
                        index % 2 === 0 ? "bg-surface" : "bg-surface-elevated/40"
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editForm.event_date}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                event_date: event.target.value,
                              }))
                            }
                            className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                          />
                        ) : (
                          formatEventDate(entry.event_date)
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isEditing ? (
                          <select
                            value={editForm.sport_id}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                sport_id: event.target.value,
                              }))
                            }
                            className="max-w-[160px] rounded-lg border border-border bg-background px-2 py-1 text-sm"
                          >
                            {sports.map((sport) => (
                              <option key={sport.id} value={sport.id}>
                                {sport.abbreviation}
                              </option>
                            ))}
                          </select>
                        ) : (
                          entry.sport
                        )}
                      </td>
                      <td className="px-4 py-3 min-w-[180px]">
                        {isEditing ? (
                          <input
                            value={editForm.event_name}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                event_name: event.target.value,
                              }))
                            }
                            className="w-full min-w-[160px] rounded-lg border border-border bg-background px-2 py-1 text-sm"
                          />
                        ) : (
                          entry.event_name
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">
                        {isEditing ? (
                          <input
                            inputMode="numeric"
                            value={editForm.line}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                line: sanitizeLineInput(event.target.value),
                              }))
                            }
                            className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                          />
                        ) : (
                          formatOdds(entry.line)
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap text-right">
                        {isEditing ? (
                          <input
                            inputMode="decimal"
                            value={editForm.risk}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                risk: sanitizeRiskInput(event.target.value),
                              }))
                            }
                            className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-sm text-right"
                          />
                        ) : (
                          formatCurrency(entry.risk)
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap text-right">
                        {formatCurrency(entry.to_win)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isEditing || isAdmin ? (
                          <select
                            value={isEditing ? editForm.status : entry.status}
                            onChange={(event) => {
                              const status = event.target.value as BetStatus;
                              if (isEditing) {
                                setEditForm((current) => ({ ...current, status }));
                              } else {
                                handleStatusChange(entry.id, status);
                              }
                            }}
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
                        className={`px-4 py-3 font-mono whitespace-nowrap text-right ${
                          entry.profit_loss > 0
                            ? "text-emerald-400"
                            : entry.profit_loss < 0
                              ? "text-red-400"
                              : "text-muted"
                        }`}
                      >
                        {formatCurrency(entry.profit_loss)}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(entry.id)}
                                className="text-xs text-accent hover:underline"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="text-xs text-muted hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(entry)}
                                aria-label="Edit entry"
                                className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
                              >
                                <PencilIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(entry.id)}
                                aria-label="Delete entry"
                                className="rounded-lg p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-300"
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
            {entries.length > 0 && (
              <tfoot className="border-t border-border bg-surface-elevated">
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-right font-medium">
                    Total P/L
                  </td>
                  <td
                    className={`px-4 py-3 font-mono font-semibold text-right ${
                      totalProfitLoss > 0
                        ? "text-emerald-400"
                        : totalProfitLoss < 0
                          ? "text-red-400"
                          : "text-muted"
                    }`}
                  >
                    {formatCurrency(totalProfitLoss)}
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
