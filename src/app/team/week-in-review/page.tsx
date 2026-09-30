import Link from "next/link";
import { WeekInReviewEmail } from "@/components/WeekInReviewEmail";
import { requireTeamProfile } from "@/lib/auth/team";
import { createClient } from "@/lib/supabase/server";
import {
  computeDailyPlSeries,
  computeDayResultsStats,
  computeSportBetStats,
  formatCurrencyWhole,
  formatPercent,
  formatWeekRangeLabel,
  getPreviousWeekRange,
  getRollingWeekRange,
  withComputedFields,
  type BetEntryRow,
  type DayPlPoint,
} from "@/lib/bets/calculations";
import type { Sport } from "@/lib/sports/types";

type WeekView = "rolling" | "week";

function profitLossClassName(value: number) {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-muted";
}

/** Compact money for dense cells: $62.4K, -$8.4K, $0. */
function compactMoney(value: number) {
  const sign = value < 0 ? "-" : value > 0 ? "+" : "";
  const magnitude = Math.abs(value);

  if (magnitude < 1000) {
    return `${sign}$${Math.round(magnitude)}`;
  }

  return `${sign}$${(magnitude / 1000).toFixed(1)}K`;
}

function dayLabel(date: string, view: WeekView) {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(parsed);

  return view === "week" ? weekday : `${weekday} ${day}`;
}

/** Share of the tallest bar, so the strip scales to whatever the week held. */
function barPercent(value: number, peak: number) {
  if (peak <= 0 || value === 0) return 0;
  return Math.max(6, Math.round((Math.abs(value) / peak) * 100));
}

function DayColumn({ point, peak, view }: { point: DayPlPoint; peak: number; view: WeekView }) {
  const height = barPercent(point.profitLoss, peak);
  const positive = point.profitLoss > 0;
  const negative = point.profitLoss < 0;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-24 w-full flex-col">
        <div className="flex flex-1 items-end justify-center">
          {positive ? (
            <div
              className="w-3/5 rounded-t bg-emerald-400/80"
              style={{ height: `${height}%` }}
            />
          ) : null}
        </div>
        <div className="h-px w-full bg-border" />
        <div className="flex flex-1 items-start justify-center">
          {negative ? (
            <div
              className="w-3/5 rounded-b bg-red-400/80"
              style={{ height: `${height}%` }}
            />
          ) : null}
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs text-muted">{dayLabel(point.date, view)}</p>
        <p className={`text-xs tabular-nums ${profitLossClassName(point.profitLoss)}`}>
          {point.playCount === 0 ? "—" : compactMoney(point.profitLoss)}
        </p>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  valueClassName = "",
  wide = false,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-4 ${wide ? "sm:col-span-2" : ""}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p
        className={`mt-2 font-semibold tabular-nums ${wide ? "text-3xl" : "text-xl"} ${valueClassName}`}
      >
        {value}
      </p>
    </div>
  );
}

export default async function WeekInReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const profile = await requireTeamProfile("/team/week-in-review");

  const params = await searchParams;
  const view: WeekView = params.view === "week" ? "week" : "rolling";
  const { weekStart, weekEnd } =
    view === "week" ? getPreviousWeekRange() : getRollingWeekRange();

  const supabase = await createClient();
  const [entriesResult, sportsResult] = await Promise.all([
    supabase
      .from("bet_entries")
      .select("*, sports(abbreviation, full_name)")
      .gte("event_date", weekStart)
      .lte("event_date", weekEnd)
      .order("event_date", { ascending: true }),
    supabase.from("sports").select("*").order("sort_order"),
  ]);

  const loadFailed = Boolean(entriesResult.error || sportsResult.error);
  const entries = ((entriesResult.data ?? []) as BetEntryRow[]).map(withComputedFields);
  const stats = computeDayResultsStats(entries);
  const sportRows = computeSportBetStats(entries, (sportsResult.data ?? []) as Sport[]).filter(
    (row) => row.hasActivity,
  );
  const series = computeDailyPlSeries(entries, weekStart, weekEnd);
  const dayPeak = Math.max(...series.map((point) => Math.abs(point.profitLoss)), 0);
  const sportPeak = Math.max(...sportRows.map((row) => Math.abs(row.totalProfitLoss)), 0);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            Sportsbook Hub
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Week in Review</h1>
          <p className="mt-2 text-sm text-muted">
            {formatWeekRangeLabel(weekStart, weekEnd)} · through yesterday ·{" "}
            {stats.playCount}{" "}
            {stats.playCount === 1 ? "play" : "plays"}
            {stats.openCount > 0 ? ` · ${stats.openCount} still open` : ""}
          </p>
        </div>
        <nav aria-label="Week range" className="flex gap-1 rounded-full border border-border p-1">
          {(
            [
              { key: "rolling", label: "Rolling 7" },
              { key: "week", label: "Last week" },
            ] as const
          ).map((option) => (
            <Link
              key={option.key}
              href={`?view=${option.key}`}
              aria-current={view === option.key ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                view === option.key
                  ? "bg-surface-elevated text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </nav>
      </section>

      {loadFailed ? (
        <p role="alert" className="rounded-xl border border-red-400/30 p-5 text-red-300">
          The week could not be loaded. Refresh to try again.
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          wide
          label="Net P/L"
          value={formatCurrencyWhole(stats.totalProfitLoss)}
          valueClassName={profitLossClassName(stats.totalProfitLoss)}
        />
        <StatTile
          label="Record"
          value={`${stats.winCount}–${stats.lossCount}–${stats.voidCount}`}
        />
        <StatTile label="Win %" value={formatPercent(stats.winPct)} />
        <StatTile
          label="ROI"
          value={formatPercent(stats.roi)}
          valueClassName={profitLossClassName(stats.roi ?? 0)}
        />
        <StatTile label="Risked" value={formatCurrencyWhole(stats.totalRisked)} />
      </section>

      <section
        aria-labelledby="daily-pl"
        className="rounded-2xl border border-border bg-surface p-5"
      >
        <h2
          id="daily-pl"
          className="text-[10px] font-semibold uppercase tracking-widest text-muted"
        >
          Daily P/L
        </h2>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {series.map((point) => (
            <DayColumn key={point.date} point={point} peak={dayPeak} view={view} />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="by-sport"
        className="rounded-2xl border border-border bg-surface p-5"
      >
        <h2
          id="by-sport"
          className="text-[10px] font-semibold uppercase tracking-widest text-muted"
        >
          By sport
        </h2>

        {sportRows.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No plays recorded in this range.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-2 font-medium">Sport</th>
                  <th className="py-2 font-medium">Record</th>
                  <th className="py-2 text-right font-medium">Risked</th>
                  <th className="px-3 py-2 text-center font-medium">P/L</th>
                  <th className="py-2 text-right font-medium">Win %</th>
                  <th className="py-2 text-right font-medium">ROI</th>
                </tr>
              </thead>
              <tbody>
                {sportRows.map((row) => {
                  const width = barPercent(row.totalProfitLoss, sportPeak);
                  const positive = row.totalProfitLoss > 0;
                  const negative = row.totalProfitLoss < 0;

                  return (
                    <tr key={row.sportId} className="border-t border-border/60">
                      <td className="py-2.5 font-medium">{row.sport}</td>
                      <td className="py-2.5 tabular-nums text-muted">
                        {row.winCount}–{row.lossCount}–{row.voidCount}
                        {row.openCount > 0 ? (
                          <span className="ml-2 text-xs">({row.openCount} open)</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {formatCurrencyWhole(row.totalRisked)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center">
                          <div className="flex flex-1 items-center justify-end gap-2">
                            {negative ? (
                              <>
                                <span className="whitespace-nowrap text-xs tabular-nums text-red-400">
                                  {compactMoney(row.totalProfitLoss)}
                                </span>
                                <div
                                  className="h-2 rounded-sm bg-red-400/80"
                                  style={{ width: `${width}%` }}
                                />
                              </>
                            ) : null}
                          </div>
                          <div className="h-3.5 w-px bg-border" />
                          <div className="flex flex-1 items-center gap-2">
                            {positive ? (
                              <>
                                <div
                                  className="h-2 rounded-sm bg-emerald-400/80"
                                  style={{ width: `${width}%` }}
                                />
                                <span className="whitespace-nowrap text-xs tabular-nums text-emerald-400">
                                  {compactMoney(row.totalProfitLoss)}
                                </span>
                              </>
                            ) : null}
                            {row.totalProfitLoss === 0 ? (
                              <span className="text-xs tabular-nums text-muted">$0</span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {formatPercent(row.winPct)}
                      </td>
                      <td
                        className={`py-2.5 text-right tabular-nums ${profitLossClassName(row.roi ?? 0)}`}
                      >
                        {formatPercent(row.roi)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Sending is admin-only, matching the other ledger email routes. */}
      {profile.tier === "admin" ? <WeekInReviewEmail view={view} /> : null}
    </div>
  );
}
