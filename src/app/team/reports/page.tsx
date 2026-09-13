import { requireTeamProfile } from "@/lib/auth/team";
import { createClient } from "@/lib/supabase/server";
import { computeSportBetStats, formatPercent, winPctCellClassName, withComputedFields, type BetEntryRow } from "@/lib/bets/calculations";
import type { Sport } from "@/lib/sports/types";

const amount = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function ReportsPage() {
  await requireTeamProfile("/team/reports");
  const supabase = await createClient();
  const entries: BetEntryRow[] = [];
  // Read every page so the all-time report isn't limited to Supabase's row cap.
  let loadError = false;
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("bet_entries").select("*").order("id").range(offset, offset + 999);
    if (error) { loadError = true; break; }
    entries.push(...(data as BetEntryRow[]));
    if (data.length < 1000) break;
  }
  const { data: sports, error } = await supabase.from("sports").select("*").order("sort_order");
  const rows = computeSportBetStats(entries.map(withComputedFields), (sports ?? []) as Sport[])
    .sort((a, b) => Number(b.hasActivity) - Number(a.hasActivity) || a.sortOrder - b.sortOrder || a.sport.localeCompare(b.sport));

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">Sportsbook Hub</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Reports</h1>
      </section>
      <section aria-labelledby="sport-summary" className="space-y-4">
        <div>
          <h2 id="sport-summary" className="text-xl font-semibold">Performance by sport</h2>
          <p className="mt-1 text-sm text-muted">All-time picks. Sports with picks appear first; sports with no picks are grayed out.</p>
        </div>
        {loadError || error ? (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">Could not load the report. Please refresh to try again.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[850px] border-collapse text-sm tabular-nums">
              <caption className="sr-only">All-time performance by sport</caption>
              <thead className="bg-blue-400/20">
                <tr>{["Sport", "Win", "Loss", "Void", "Open", "Graded", "Risked", "P/L", "ROI", "Win %"].map((label) => (
                  <th key={label} scope="col" className={`border-b border-r border-border px-3 py-3 font-semibold last:border-r-0 ${label === "Sport" ? "text-left" : "text-right"}`}>{label}</th>
                ))}</tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.sportId} className={`border-b border-border last:border-b-0 ${row.hasActivity ? "text-foreground" : "bg-surface text-muted/60"}`}>
                    <th scope="row" className="whitespace-nowrap border-r border-border px-3 py-3 text-left font-semibold">{row.sport}{!row.hasActivity && <span className="sr-only"> — no picks recorded</span>}</th>
                    {[row.winCount, row.lossCount, row.voidCount, row.openCount, row.gradedCount, amount.format(row.totalRisked), amount.format(row.totalProfitLoss)].map((value, index) => (
                      <td key={index} className="border-r border-border px-3 py-3 text-right">{value}</td>
                    ))}
                    <td className={`border-r border-border px-3 py-3 text-right ${row.hasActivity && row.roi ? (row.roi > 0 ? "bg-emerald-500/20" : "bg-red-500/25") : ""}`}>{formatPercent(row.roi ?? 0)}</td>
                    <td className={`px-3 py-3 text-right ${row.hasActivity ? winPctCellClassName(row.winPct) : ""}`}>{formatPercent(row.winPct ?? 0)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-muted">No sports have been configured yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted">Graded = wins + losses + voids. Risked includes all picks. ROI = P/L ÷ risked. Win % = wins ÷ graded.</p>
      </section>
    </div>
  );
}
