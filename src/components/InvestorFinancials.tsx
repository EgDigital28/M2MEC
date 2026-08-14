"use client";

import { useCallback, useEffect, useState } from "react";
import { CostCoverageTable } from "@/components/CostCoverageTable";
import { LEDGER_STARTING_BALANCE } from "@/lib/bets/calculations";
import type { InvestorFinancialsSummary, InvestorWageringStake } from "@/lib/financials/investor-summary";
import {
  computeAmountDue,
  formatAllocationPercent,
  formatDepositPct,
  formatFinancialAmount,
} from "@/lib/financials/types";
import { wageringGroupLabel } from "@/lib/financials/wagering";

const moneyCellClassName = "whitespace-nowrap text-right font-mono tabular-nums";

export function InvestorFinancials() {
  const [summary, setSummary] = useState<InvestorFinancialsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/investor/financials");
      const data = (await response.json()) as {
        summary?: InvestorFinancialsSummary;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Could not load your financials.");
        setLoading(false);
        return;
      }

      setSummary(data.summary ?? null);
    } catch {
      setError("Network error while loading your financials.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const equityStake = summary?.equityStake ?? null;

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">Investor</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Financials</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Read-only view of your equity stake, wagering positions, and platform cost coverage.
        </p>
        {summary?.reportAlias ? (
          <p className="mt-2 text-sm text-muted">
            Report alias: <span className="font-medium text-foreground">{summary.reportAlias}</span>
          </p>
        ) : null}
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <CostCoverageTable apiPath="/api/investor/cost-coverage" />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Equity stake</h2>
          <p className="mt-1 text-sm text-muted">Your IO allocation, cash value, deposit, and amount due.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-elevated text-left text-muted">
                  <th className="px-4 py-3 font-medium">IO Allocation</th>
                  <th className={`${moneyCellClassName} px-4 py-3 font-medium`}>IO Cash Value</th>
                  <th className={`${moneyCellClassName} px-4 py-3 font-medium`}>Deposit</th>
                  <th className={`${moneyCellClassName} px-4 py-3 font-medium`}>Deposit %</th>
                  <th className={`${moneyCellClassName} px-4 py-3 font-medium`}>Amount Due</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
                      Loading equity stake...
                    </td>
                  </tr>
                ) : !equityStake ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
                      No equity stake assigned yet.
                    </td>
                  </tr>
                ) : (
                  <tr className="border-b border-border/60">
                    <td className="px-4 py-3 font-medium">
                      {formatAllocationPercent(equityStake.io_allocation)}
                    </td>
                    <td className={`${moneyCellClassName} px-4 py-3`}>
                      {formatFinancialAmount(equityStake.io_cash_value)}
                    </td>
                    <td className={`${moneyCellClassName} px-4 py-3`}>
                      {formatFinancialAmount(equityStake.deposit)}
                    </td>
                    <td className={`${moneyCellClassName} px-4 py-3`}>
                      {formatDepositPct(equityStake.deposit, equityStake.io_cash_value)}
                    </td>
                    <td className={`${moneyCellClassName} px-4 py-3`}>
                      {formatFinancialAmount(
                        computeAmountDue(equityStake.io_cash_value, equityStake.deposit),
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Wagering stake</h2>
          <p className="mt-1 text-sm text-muted">
            Your capital deposits by group. Ownership % is your share of total group capital;
            value is based on overall platform P/L.
          </p>
        </div>

        {summary ? (
          <div className="rounded-2xl border border-border bg-surface-elevated p-5">
            <p className="text-xs font-medium uppercase tracking-widest text-muted">Overall P/L</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatFinancialAmount(summary.overallPl)}
            </p>
            <p className="mt-1 text-xs text-muted">
              Starting balance {formatFinancialAmount(LEDGER_STARTING_BALANCE)} + ledger net P/L{" "}
              {formatFinancialAmount(summary.totalProfitLoss)}
            </p>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-elevated text-left text-muted">
                  <th className="px-4 py-3 font-medium">Group</th>
                  <th className={`${moneyCellClassName} px-4 py-3 font-medium`}>Capital Deposit</th>
                  <th className={`${moneyCellClassName} px-4 py-3 font-medium`}>Ownership %</th>
                  <th className={`${moneyCellClassName} px-4 py-3 font-medium`}>Value</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted">
                      Loading wagering stakes...
                    </td>
                  </tr>
                ) : !summary || summary.wageringStakes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted">
                      No wagering stakes assigned yet.
                    </td>
                  </tr>
                ) : (
                  summary.wageringStakes.map((stake) => (
                    <WageringStakeRow key={stake.id} stake={stake} />
                  ))
                )}
              </tbody>
              {summary && summary.wageringStakes.length > 0 ? (
                <tfoot>
                  <tr className="border-t border-border bg-surface-elevated/60 font-semibold">
                    <td className="px-4 py-3">Total</td>
                    <td className={`${moneyCellClassName} px-4 py-3`}>
                      {formatFinancialAmount(
                        summary.wageringStakes.reduce(
                          (total, stake) => total + stake.capital_deposit,
                          0,
                        ),
                      )}
                    </td>
                    <td className={`${moneyCellClassName} px-4 py-3`}>
                      {formatAllocationPercent(
                        summary.wageringStakes.reduce(
                          (total, stake) => total + stake.ownershipPct,
                          0,
                        ),
                      )}
                    </td>
                    <td className={`${moneyCellClassName} px-4 py-3`}>
                      {formatFinancialAmount(summary.totalWageringValue)}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function WageringStakeRow({ stake }: { stake: InvestorWageringStake }) {
  const group = stake.group && !Array.isArray(stake.group) ? stake.group : null;

  return (
    <tr className="border-b border-border/60">
      <td className="px-4 py-3 font-medium">
        {group ? wageringGroupLabel(group) : "Unknown group"}
      </td>
      <td className={`${moneyCellClassName} px-4 py-3`}>
        {formatFinancialAmount(stake.capital_deposit)}
      </td>
      <td className={`${moneyCellClassName} px-4 py-3`}>
        {formatAllocationPercent(stake.ownershipPct)}
      </td>
      <td className={`${moneyCellClassName} px-4 py-3`}>
        {formatFinancialAmount(stake.value)}
      </td>
    </tr>
  );
}
