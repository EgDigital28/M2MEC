"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  BET_STATUSES,
  formatCurrency,
  formatEventDate,
  formatOdds,
  formatRiskInput,
  parseRiskAmount,
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

const fieldClassName =
  "h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent";

const tableFieldClassName =
  "h-8 w-full min-w-0 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-accent";

function sanitizeLineInput(value: string) {
  if (value === "" || value === "-") {
    return value;
  }

  const match = value.match(/^-?\d*/);
  return match?.[0] ?? "";
}

function entryToForm(entry: BetEntryComputed): EntryForm {
  return {
    event_date: entry.event_date,
    sport_id: entry.sport_id,
    event_name: entry.event_name,
    line: String(Math.trunc(entry.line)),
    risk: formatRiskInput(entry.risk.toFixed(2)),
    status: entry.status,
  };
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path
        fillRule="evenodd"
        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
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
      setEditingId(null);
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
    setEditingId(null);

    const risk = parseRiskAmount(form.risk);

    try {
      const response = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_date: form.event_date,
          sport_id: form.sport_id,
          event_name: form.event_name,
          line: Number.parseInt(form.line, 10),
          risk,
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

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyForm);
  }

  async function handleSaveEdit(id: string) {
    setError(null);

    const line = Number.parseInt(editForm.line, 10);
    const risk = parseRiskAmount(editForm.risk);

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

      cancelEdit();
    } catch {
      setError("Network error while updating entry.");
    }
  }

  async function handleStatusChange(id: string, status: BetStatus) {
    if (editingId) {
      return;
    }

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
        cancelEdit();
      }
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
                className={fieldClassName}
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
                className={fieldClassName}
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
                className={fieldClassName}
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
                className={`${fieldClassName} font-mono`}
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
                      risk: formatRiskInput(event.target.value),
                    }))
                  }
                  placeholder="11.00"
                  className={`${fieldClassName} pl-7 font-mono`}
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

      {editingId && (
        <p className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-xs text-accent">
          Editing a row — use the checkmark to save or X to cancel.
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full table-fixed text-xs">
            <thead className="border-b border-border bg-surface-elevated text-left">
              <tr>
                <th className="w-[88px] px-2 py-2 font-medium text-muted">Date</th>
                <th className="w-[88px] px-2 py-2 font-medium text-muted">Sport</th>
                <th className="px-2 py-2 font-medium text-muted">Event</th>
                <th className="w-[56px] px-2 py-2 font-medium text-muted">Line</th>
                <th className="w-[88px] px-2 py-2 font-medium text-muted text-right">Risk</th>
                <th className="w-[80px] px-2 py-2 font-medium text-muted text-right">To Win</th>
                <th className="w-[72px] px-2 py-2 font-medium text-muted">W/L</th>
                <th className="w-[80px] px-2 py-2 font-medium text-muted text-right">P/L</th>
                {isAdmin && (
                  <th className="sticky right-0 z-10 w-[68px] bg-surface-elevated px-2 py-2 font-medium text-muted text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.6)]">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-2 py-8 text-center text-muted">
                    Loading entries...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-2 py-8 text-center text-muted">
                    No entries yet.
                  </td>
                </tr>
              ) : (
                entries.map((entry, index) => {
                  const isEditing = editingId === entry.id;
                  const rowBg = index % 2 === 0 ? "bg-surface" : "bg-surface-elevated/40";

                  return (
                    <tr key={entry.id} className={`border-t border-border ${rowBg}`}>
                      <td className="px-2 py-2">
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
                            className={tableFieldClassName}
                          />
                        ) : (
                          <span className="whitespace-nowrap">{formatEventDate(entry.event_date)}</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <select
                            value={editForm.sport_id}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                sport_id: event.target.value,
                              }))
                            }
                            className={tableFieldClassName}
                          >
                            {sports.map((sport) => (
                              <option key={sport.id} value={sport.id}>
                                {sport.abbreviation}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="truncate">{entry.sport}</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <input
                            value={editForm.event_name}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                event_name: event.target.value,
                              }))
                            }
                            className={tableFieldClassName}
                          />
                        ) : (
                          <span className="block truncate">{entry.event_name}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 font-mono">
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
                            className={`${tableFieldClassName} text-center`}
                          />
                        ) : (
                          formatOdds(entry.line)
                        )}
                      </td>
                      <td className="px-2 py-2 font-mono text-right">
                        {isEditing ? (
                          <input
                            inputMode="decimal"
                            value={editForm.risk}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                risk: formatRiskInput(event.target.value),
                              }))
                            }
                            className={`${tableFieldClassName} text-right`}
                          />
                        ) : (
                          formatCurrency(entry.risk)
                        )}
                      </td>
                      <td className="px-2 py-2 font-mono text-right">
                        {formatCurrency(entry.to_win)}
                      </td>
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <select
                            value={editForm.status}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                status: event.target.value as BetStatus,
                              }))
                            }
                            className={tableFieldClassName}
                          >
                            {BET_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        ) : isAdmin ? (
                          <select
                            value={entry.status}
                            onChange={(event) =>
                              handleStatusChange(entry.id, event.target.value as BetStatus)
                            }
                            className={tableFieldClassName}
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
                        className={`px-2 py-2 font-mono text-right ${
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
                        <td
                          className={`sticky right-0 z-10 px-1 py-2 text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.6)] ${rowBg}`}
                        >
                          {isEditing ? (
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(entry.id)}
                                aria-label="Save entry"
                                title="Save"
                                className="rounded-md p-1.5 text-emerald-400 transition-colors hover:bg-emerald-500/10"
                              >
                                <CheckIcon />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                aria-label="Cancel edit"
                                title="Cancel"
                                className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
                              >
                                <XIcon />
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(entry)}
                                aria-label="Edit entry"
                                title="Edit"
                                className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
                              >
                                <PencilIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(entry.id)}
                                aria-label="Delete entry"
                                title="Delete"
                                className="rounded-md p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-300"
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
                  <td colSpan={7} className="px-2 py-2 text-right font-medium">
                    Total P/L
                  </td>
                  <td
                    className={`px-2 py-2 font-mono font-semibold text-right ${
                      totalProfitLoss > 0
                        ? "text-emerald-400"
                        : totalProfitLoss < 0
                          ? "text-red-400"
                          : "text-muted"
                    }`}
                  >
                    {formatCurrency(totalProfitLoss)}
                  </td>
                  {isAdmin && (
                    <td className="sticky right-0 z-10 bg-surface-elevated shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.6)]" />
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
