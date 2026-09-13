"use client";

import { useCallback, useEffect, useState } from "react";
import {
  computeDayResultsStats,
  formatCurrency,
  formatCurrencyWhole,
  formatEventDate,
  formatOdds,
  formatPercent,
  type BetEntryComputed,
  type DayResultsStats,
} from "@/lib/bets/calculations";

const moneyCellClassName = "whitespace-nowrap text-right font-mono tabular-nums";

type InvestorPlaysPayload = {
  resultsDate: string;
  yesterdaysResults: BetEntryComputed[];
  yesterdaysStats: DayResultsStats;
  upcomingPlays: BetEntryComputed[];
};

function formatResultsHeading(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function profitLossClassName(value: number) {
  if (value > 0) {
    return "text-emerald-400";
  }

  if (value < 0) {
    return "text-red-300";
  }

  return "text-muted";
}

function statusClassName(status: string) {
  if (status === "Win") {
    return "text-emerald-400";
  }

  if (status === "Loss") {
    return "text-red-300";
  }

  return "text-muted";
}

export function InvestorPlaysSection() {
  const [payload, setPayload] = useState<InvestorPlaysPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlays = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/investor/plays");
      const data = (await response.json()) as InvestorPlaysPayload & { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not load plays.");
        setLoading(false);
        return;
      }

      setPayload(data);
    } catch {
      setError("Network error while loading plays.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlays();
  }, [loadPlays]);

  const stats = payload?.yesterdaysStats ?? computeDayResultsStats([]);
  const resultsDate = payload?.resultsDate ?? "";

  return (
    <div className="space-y-8 pt-2">
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Yesterday&apos;s Results</h3>
          {resultsDate ? (
            <p className="mt-1 text-sm text-muted">{formatResultsHeading(resultsDate)}</p>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        {!loading && payload && payload.yesterdaysResults.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Plays" value={String(stats.playCount)} />
            <MiniStat
              label="P/L"
              value={formatCurrencyWhole(stats.totalProfitLoss)}
              valueClassName={profitLossClassName(stats.totalProfitLoss)}
            />
            <MiniStat label="Win %" value={formatPercent(stats.winPct)} />
            <MiniStat
              label="ROI"
              value={formatPercent(stats.roi)}
              valueClassName={profitLossClassName(stats.roi ?? 0)}
            />
          </div>
        ) : null}

        <PlaysTable
          loading={loading}
          emptyMessage="No plays recorded for yesterday."
          columns={[
            { key: "date", label: "Date" },
            { key: "sport", label: "Sport" },
            { key: "event", label: "Event" },
            { key: "line", label: "Line", align: "right" },
            { key: "risk", label: "Risk", align: "right" },
            { key: "result", label: "Result" },
            { key: "pl", label: "P/L", align: "right" },
          ]}
          rows={
            payload?.yesterdaysResults.map((entry) => ({
              key: entry.id,
              cells: [
                { content: formatEventDate(entry.event_date) },
                { content: entry.sport },
                { content: entry.event_name, className: "font-medium" },
                { content: formatOdds(entry.line), align: "right" },
                { content: formatCurrency(entry.risk), align: "right" },
                { content: entry.status, className: statusClassName(entry.status) },
                {
                  content: formatCurrency(entry.profit_loss),
                  align: "right",
                  className: profitLossClassName(entry.profit_loss),
                },
              ],
            })) ?? []
          }
        />
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Upcoming Plays</h3>
          <p className="mt-1 text-sm text-muted">Open plays from today onward.</p>
        </div>

        <PlaysTable
          loading={loading}
          emptyMessage="No upcoming open plays."
          columns={[
            { key: "date", label: "Date" },
            { key: "sport", label: "Sport" },
            { key: "event", label: "Event" },
            { key: "line", label: "Line", align: "right" },
            { key: "risk", label: "Risk", align: "right" },
            { key: "toWin", label: "To Win", align: "right" },
          ]}
          rows={
            payload?.upcomingPlays.map((entry) => ({
              key: entry.id,
              cells: [
                { content: formatEventDate(entry.event_date) },
                { content: entry.sport },
                { content: entry.event_name, className: "font-medium" },
                { content: formatOdds(entry.line), align: "right" },
                { content: formatCurrency(entry.risk), align: "right" },
                { content: formatCurrency(entry.to_win), align: "right" },
              ],
            })) ?? []
          }
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${valueClassName ?? ""}`}>{value}</p>
    </div>
  );
}

type PlaysTableColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
};

type PlaysTableCell = {
  content: string;
  align?: "left" | "right";
  className?: string;
};

function PlaysTable({
  loading,
  emptyMessage,
  columns,
  rows,
}: {
  loading: boolean;
  emptyMessage: string;
  columns: PlaysTableColumn[];
  rows: { key: string; cells: PlaysTableCell[] }[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-surface-elevated text-left text-muted">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 font-medium ${
                    column.align === "right" ? moneyCellClassName : ""
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">
                  Loading plays...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="border-b border-border/60">
                  {row.cells.map((cell, index) => (
                    <td
                      key={`${row.key}-${columns[index]?.key ?? index}`}
                      className={`px-4 py-3 ${
                        cell.align === "right" || columns[index]?.align === "right"
                          ? moneyCellClassName
                          : ""
                      } ${cell.className ?? ""}`}
                    >
                      {cell.content}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
