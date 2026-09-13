"use client";

import { useCallback, useEffect, useState } from "react";
import type { CostCoverageSummary } from "@/lib/expenses/summaries";
import { formatExpenseAmount } from "@/lib/expenses/types";

const moneyCellClassName = "whitespace-nowrap text-right font-mono tabular-nums";

function AmountCell({ amount }: { amount: number }) {
  if (amount < 0) {
    return <span className="text-red-300">{formatExpenseAmount(amount)}</span>;
  }

  return (
    <span className={amount === 0 ? "text-muted/70" : undefined}>{formatExpenseAmount(amount)}</span>
  );
}

type CostCoverageTableProps = {
  apiPath?: string;
};

export function CostCoverageTable({ apiPath = "/api/financials/cost-coverage" }: CostCoverageTableProps) {
  const [summary, setSummary] = useState<CostCoverageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrationRequired, setMigrationRequired] = useState(false);

  const loadCoverage = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMigrationRequired(false);

    try {
      const response = await fetch(apiPath);
      const data = (await response.json()) as { summary?: CostCoverageSummary; error?: string };

      if (!response.ok) {
        if (response.status === 503) {
          setMigrationRequired(true);
        } else {
          setError(data.error ?? "Could not load cost coverage.");
        }
        setLoading(false);
        return;
      }

      setSummary(data.summary ?? null);
    } catch {
      setError("Network error while loading cost coverage.");
    } finally {
      setLoading(false);
    }
  }, [apiPath]);

  useEffect(() => {
    void loadCoverage();
  }, [loadCoverage]);

  const currentYear = summary?.currentYear ?? new Date().getFullYear();
  const nextYear = summary?.nextYear ?? currentYear + 1;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Cost coverage</h2>
        <p className="mt-1 text-sm text-muted">
          Budget line items with year-to-date spend and obligations. Wagering coverage uses overall
          P/L from the ledger; capital coverage uses equity stake deposits. Voids are excluded.
        </p>
      </div>

      {migrationRequired && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Run <code className="text-foreground">010_expenses.sql</code> in Supabase to enable cost
          coverage.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {!loading && summary ? (
        <div className="rounded-2xl border border-border bg-surface-elevated p-5">
          <p className="text-xs font-medium uppercase tracking-widest text-muted">
            Forecasted Capital
          </p>
          <p
            className={`mt-2 text-2xl font-semibold tabular-nums ${
              summary.forecastedCapital < 0 ? "text-red-300" : ""
            }`}
          >
            {formatExpenseAmount(summary.forecastedCapital)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Deposited capital {formatExpenseAmount(summary.depositedCapital)} vs {nextYear}{" "}
            capital obligation{" "}
            {formatExpenseAmount(
              summary.rows.find((row) => row.id === "capital-coverage")?.nextYearObligation ?? 0,
            )}
          </p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-elevated text-left text-muted">
                <th className="px-4 py-3 font-medium">Budget Line Item</th>
                <th className={`${moneyCellClassName} px-4 py-3 font-medium`}>YTD</th>
                <th className={`${moneyCellClassName} px-4 py-3 font-medium`}>
                  {currentYear} Obligation
                </th>
                <th className={`${moneyCellClassName} px-4 py-3 font-medium`}>
                  {nextYear} Obligation
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    Loading cost coverage...
                  </td>
                </tr>
              ) : !summary || summary.rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    No cost coverage data yet.
                  </td>
                </tr>
              ) : (
                summary.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className={`${moneyCellClassName} px-4 py-3`}>
                      <AmountCell amount={row.ytd} />
                    </td>
                    <td className={`${moneyCellClassName} px-4 py-3`}>
                      <AmountCell amount={row.currentYearObligation} />
                    </td>
                    <td className={`${moneyCellClassName} px-4 py-3`}>
                      <AmountCell amount={row.nextYearObligation} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
