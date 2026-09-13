"use client";

import { useCallback, useEffect, useState } from "react";
import { LEDGER_STARTING_BALANCE } from "@/lib/bets/calculations";
import type { CostCoverageSummary } from "@/lib/expenses/summaries";
import { formatExpenseAmount } from "@/lib/expenses/types";
import {
  computeAmountDue,
  formatAllocationPercent,
  formatDepositPct,
  formatFinancialAmount,
} from "@/lib/financials/types";
import type { InvestorFinancialsSummary, InvestorWageringStake } from "@/lib/financials/investor-summary";
import { InvestorPlaysSection } from "@/components/InvestorPlaysSection";

type InvestorOverviewProps = {
  displayName: string;
};

export function InvestorOverview({ displayName }: InvestorOverviewProps) {
  const [summary, setSummary] = useState<InvestorFinancialsSummary | null>(null);
  const [costCoverage, setCostCoverage] = useState<CostCoverageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [costCoverageError, setCostCoverageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCostCoverageError(null);

    try {
      const [financialsResponse, coverageResponse] = await Promise.all([
        fetch("/api/investor/financials"),
        fetch("/api/investor/cost-coverage"),
      ]);

      const financialsData = (await financialsResponse.json()) as {
        summary?: InvestorFinancialsSummary;
        error?: string;
      };
      const coverageData = (await coverageResponse.json()) as {
        summary?: CostCoverageSummary;
        error?: string;
      };

      if (!financialsResponse.ok) {
        setError(financialsData.error ?? "Could not load your financial summary.");
      } else {
        setSummary(financialsData.summary ?? null);
      }

      if (!coverageResponse.ok) {
        setCostCoverageError(coverageData.error ?? "Could not load overall performance.");
      } else {
        setCostCoverage(coverageData.summary ?? null);
      }
    } catch {
      setError("Network error while loading your summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const equityStake = summary?.equityStake ?? null;
  const wageringStakes = summary?.wageringStakes ?? [];
  const nextYear = costCoverage?.nextYear ?? new Date().getFullYear() + 1;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">Investor</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Welcome, {displayName}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Your investor portal for stake summaries, platform performance, and financial reporting.
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

      {loading ? (
        <p className="text-sm text-muted">Loading your summary...</p>
      ) : (
        <div className="space-y-10">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Overall Performance</h2>
            {costCoverageError ? (
              <p className="text-sm text-muted">{costCoverageError}</p>
            ) : costCoverage ? (
              <div className="rounded-2xl border border-border bg-surface-elevated p-5">
                <p className="text-xs font-medium uppercase tracking-widest text-muted">
                  Forecasted Capital
                </p>
                <p
                  className={`mt-2 text-2xl font-semibold tabular-nums ${
                    costCoverage.forecastedCapital < 0 ? "text-red-300" : ""
                  }`}
                >
                  {formatExpenseAmount(costCoverage.forecastedCapital)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Deposited capital {formatExpenseAmount(costCoverage.depositedCapital)} vs {nextYear}{" "}
                  capital obligation{" "}
                  {formatExpenseAmount(
                    costCoverage.rows.find((row) => row.id === "capital-coverage")
                      ?.nextYearObligation ?? 0,
                  )}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">No performance data available yet.</p>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Equity</h2>
            {equityStake ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <SummaryCard
                  label="Equity Stake"
                  value={formatAllocationPercent(equityStake.io_allocation)}
                  detail="Your IO allocation"
                />
                <SummaryCard
                  label="Cash Value"
                  value={formatFinancialAmount(equityStake.io_cash_value)}
                  detail="Total equity commitment"
                />
                <SummaryCard
                  label="Amount Due"
                  value={formatFinancialAmount(
                    computeAmountDue(equityStake.io_cash_value, equityStake.deposit),
                  )}
                  detail={`${formatFinancialAmount(equityStake.deposit)} deposited (${formatDepositPct(equityStake.deposit, equityStake.io_cash_value)})`}
                />
              </div>
            ) : (
              <p className="text-sm text-muted">No equity stake assigned yet.</p>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Wagering</h2>
            {wageringStakes.length > 0 && summary ? (
              <div className="space-y-4">
                {wageringStakes.map((stake) => (
                  <WageringSummaryRow key={stake.id} stake={stake} summary={summary} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No wagering stake assigned yet.</p>
            )}
            <InvestorPlaysSection />
          </section>
        </div>
      )}
    </div>
  );
}

function WageringSummaryRow({
  stake,
  summary,
}: {
  stake: InvestorWageringStake;
  summary: InvestorFinancialsSummary;
}) {
  const group = stake.group && !Array.isArray(stake.group) ? stake.group : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        label="Group Name"
        value={group ? group.name : "—"}
        detail={group?.description?.trim() || "Wagering group"}
      />
      <SummaryCard
        label="Stake"
        value={formatAllocationPercent(stake.ownershipPct)}
        detail="Your ownership share of group capital"
      />
      <SummaryCard
        label="Cash Value"
        value={formatFinancialAmount(stake.value)}
        detail="Your share of overall platform P/L"
      />
      <SummaryCard
        label="Platform P/L"
        value={formatFinancialAmount(summary.overallPl)}
        detail={`Starting balance ${formatFinancialAmount(LEDGER_STARTING_BALANCE)} + ledger net P/L ${formatFinancialAmount(summary.totalProfitLoss)}`}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-5">
      <p className="text-xs font-medium uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}
