"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  BET_STATUSES,
  computeBetLedgerStats,
  computeSportBetStats,
  formatCurrency,
  formatCurrencyWhole,
  formatEventDate,
  formatOdds,
  formatPercent,
  formatRiskInput,
  parseRiskAmount,
  sortBetEntries,
  type BetEntryComputed,
  type BetStatus,
} from "@/lib/bets/calculations";
import type { Sport } from "@/lib/sports/types";
import { BetLedgerEmailActions } from "@/components/BetLedgerEmailActions";
import {
  CheckIcon,
  PencilIcon,
  tableActionButtonClass,
  TrashIcon,
  XIcon,
} from "@/components/TableActionIcons";

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

const PAGE_SIZE = 20;

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

const moneyCellClassName = "whitespace-nowrap text-right font-mono tabular-nums";

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

function profitLossClassName(value: number) {
  if (value > 0) {
    return "text-emerald-400";
  }

  if (value < 0) {
    return "text-red-400";
  }

  return "text-muted";
}

function percentHighlightClassName(value: number | null, type: "roi" | "winPct") {
  if (value === null) {
    return "";
  }

  if (type === "roi") {
    if (value > 0) {
      return "bg-emerald-500/20";
    }

    if (value < 0) {
      return "bg-red-500/20";
    }

    return "";
  }

  if (value >= 0.6) {
    return "bg-emerald-600/30";
  }

  if (value >= 0.55) {
    return "bg-emerald-500/20";
  }

  if (value >= 0.5) {
    return "bg-emerald-500/10";
  }

  if (value > 0) {
    return "bg-red-500/20";
  }

  return "";
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
  const [page, setPage] = useState(1);
  const [showDetailedStats, setShowDetailedStats] = useState(false);

  const activeSports = useMemo(
    () => sports.filter((sport) => sport.is_active),
    [sports],
  );

  const sortedEntries = useMemo(() => sortBetEntries(entries), [entries]);
  const stats = useMemo(() => computeBetLedgerStats(sortedEntries), [sortedEntries]);
  const sportStats = useMemo(
    () => computeSportBetStats(sortedEntries, sports),
    [sortedEntries, sports],
  );
  const totalPages = Math.max(1, Math.ceil(sortedEntries.length / PAGE_SIZE));

  const paginatedEntries = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedEntries.slice(start, start + PAGE_SIZE);
  }, [sortedEntries, page]);

  const pageStart = sortedEntries.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, sortedEntries.length);

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

      setEntries(sortBetEntries(entriesData.entries ?? []));
      setSports(sportsData.sports ?? []);
      setEditingId(null);
      setPage(1);
    } catch {
      setError("Network error while loading entries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function updateEntries(nextEntries: BetEntryComputed[]) {
    setEntries(sortBetEntries(nextEntries));
  }

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
        updateEntries([...entries, data.entry]);
        setPage(1);
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
        updateEntries(entries.map((entry) => (entry.id === id ? data.entry! : entry)));
      }

      cancelEdit();
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

      updateEntries(entries.filter((entry) => entry.id !== id));
      if (editingId === id) {
        cancelEdit();
      }
    } catch {
      setError("Network error while deleting entry.");
    }
  }

  return (
    <div className="space-y-8">
      {isAdmin && !loading && <BetLedgerEmailActions entries={sortedEntries} />}

      {!loading && (
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="rounded-2xl border border-border bg-surface-elevated p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted">
                Total P/L
              </p>
              <p
                className={`mt-2 text-2xl font-semibold tabular-nums ${profitLossClassName(stats.totalProfitLoss)}`}
              >
                {formatCurrencyWhole(stats.totalProfitLoss)}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface-elevated p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted">
                Win %
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatPercent(stats.winPct)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {stats.winCount} wins / {stats.gradedCount} graded
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface-elevated p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted">
                ROI
              </p>
              <p
                className={`mt-2 text-2xl font-semibold tabular-nums ${profitLossClassName(stats.roi ?? 0)}`}
              >
                {formatPercent(stats.roi)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {formatCurrencyWhole(stats.totalProfitLoss)} on {formatCurrencyWhole(stats.totalRisked)} risked
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface-elevated p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted">
                Avg risk / play
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {stats.avgRiskPerPlay === null
                  ? "—"
                  : formatCurrencyWhole(stats.avgRiskPerPlay)}
              </p>
              <p className="mt-1 text-xs text-muted">Across all entries</p>
            </div>

            <div className="rounded-2xl border border-border bg-surface-elevated p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted">
                Entries
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {stats.totalEntries}
              </p>
              <p className="mt-1 text-xs text-muted">
                {stats.openCount} open · {stats.winCount}W · {stats.lossCount}L ·{" "}
                {stats.voidCount}V
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface-elevated p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted">
                Open risk
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatCurrencyWhole(stats.openRisk)}
              </p>
              <p className="mt-1 text-xs text-muted">Across open positions</p>
            </div>

            <div className="rounded-2xl border border-border bg-surface-elevated p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted">
                Record
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {stats.winCount}-{stats.lossCount}-{stats.voidCount}
              </p>
              <p className="mt-1 text-xs text-muted">Win-loss-void (graded only)</p>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowDetailedStats((current) => !current)}
              className="text-sm font-medium text-accent hover:underline"
            >
              {showDetailedStats ? "Hide stats by sport" : "View stats by sport"}
            </button>

            {showDetailedStats && (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
                <table className="min-w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-surface-elevated text-left text-muted">
                      <th className="px-3 py-2.5 font-medium">Sport</th>
                      <th className="px-3 py-2.5 text-center font-medium">Win</th>
                      <th className="px-3 py-2.5 text-center font-medium">Loss</th>
                      <th className="px-3 py-2.5 text-center font-medium">Void</th>
                      <th className="px-3 py-2.5 text-center font-medium">Open</th>
                      <th className="px-3 py-2.5 text-center font-medium">Graded</th>
                      <th className="px-3 py-2.5 text-right font-medium">Risked</th>
                      <th className="px-3 py-2.5 text-right font-medium">P/L</th>
                      <th className="px-3 py-2.5 text-center font-medium">ROI</th>
                      <th className="px-3 py-2.5 text-center font-medium">Win %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sportStats.map((row) => (
                      <tr
                        key={row.sportId}
                        className={`border-b border-border/60 ${row.hasActivity ? "text-foreground" : "text-muted/60"}`}
                      >
                        <td className={`px-3 py-2 ${row.hasActivity ? "font-semibold" : ""}`}>
                          {row.sport}
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums">{row.winCount}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{row.lossCount}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{row.voidCount}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{row.openCount}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{row.gradedCount}</td>
                        <td className={`${moneyCellClassName} px-3 py-2`}>
                          {formatCurrencyWhole(row.totalRisked)}
                        </td>
                        <td
                          className={`${moneyCellClassName} px-3 py-2 ${profitLossClassName(row.totalProfitLoss)}`}
                        >
                          {formatCurrencyWhole(row.totalProfitLoss)}
                        </td>
                        <td
                          className={`px-3 py-2 text-center tabular-nums ${percentHighlightClassName(row.roi, "roi")}`}
                        >
                          {formatPercent(row.roi)}
                        </td>
                        <td
                          className={`px-3 py-2 text-center tabular-nums ${percentHighlightClassName(row.winPct, "winPct")}`}
                        >
                          {formatPercent(row.winPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

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
          <table className="min-w-[920px] w-full table-fixed text-xs">
            <colgroup>
              <col className="w-[74px]" />
              <col className="w-[88px]" />
              <col className="w-[128px]" />
              <col className="w-[52px]" />
              <col className="w-[108px]" />
              <col className="w-[108px]" />
              <col className="w-[64px]" />
              <col className="w-[108px]" />
              {isAdmin && <col className="w-[68px]" />}
            </colgroup>
            <thead className="border-b border-border bg-surface-elevated text-left">
              <tr>
                <th className="px-2 py-2 font-medium text-muted">Date</th>
                <th className="px-2 py-2 font-medium text-muted">Sport</th>
                <th className="px-2 py-2 font-medium text-muted">Event</th>
                <th className="px-2 py-2 font-medium text-muted">Line</th>
                <th className="px-2 py-2 font-medium text-muted text-right">Risk</th>
                <th className="px-2 py-2 font-medium text-muted text-right">To Win</th>
                <th className="px-2 py-2 font-medium text-muted">W/L</th>
                <th className="px-2 py-2 font-medium text-muted text-right">P/L</th>
                {isAdmin && (
                  <th className="sticky right-0 z-10 bg-surface-elevated px-2 py-2 font-medium text-muted text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.6)]">
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
              ) : paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-2 py-8 text-center text-muted">
                    No entries yet.
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry, index) => {
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
                          <span className="block truncate">{entry.sport}</span>
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
                          <span className="block truncate" title={entry.event_name}>
                            {entry.event_name}
                          </span>
                        )}
                      </td>
                      <td className={`px-2 py-2 font-mono whitespace-nowrap ${isEditing ? "" : ""}`}>
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
                      <td className={`px-2 py-2 ${moneyCellClassName}`}>
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
                      <td className={moneyCellClassName}>{formatCurrency(entry.to_win)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
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
                        ) : (
                          entry.status
                        )}
                      </td>
                      <td className={`${moneyCellClassName} ${profitLossClassName(entry.profit_loss)}`}>
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
                                className={tableActionButtonClass.save}
                              >
                                <CheckIcon />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                aria-label="Cancel edit"
                                title="Cancel"
                                className={tableActionButtonClass.cancel}
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
                                className={tableActionButtonClass.edit}
                              >
                                <PencilIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(entry.id)}
                                aria-label="Delete entry"
                                title="Delete"
                                className={tableActionButtonClass.delete}
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
          </table>
        </div>

        {!loading && sortedEntries.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-border bg-surface-elevated px-4 py-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {pageStart}-{pageEnd} of {sortedEntries.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-border px-3 py-1.5 transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="tabular-nums">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-border px-3 py-1.5 transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
