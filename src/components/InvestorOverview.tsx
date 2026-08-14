"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LEDGER_STARTING_BALANCE } from "@/lib/bets/calculations";
import {
  computeAmountDue,
  formatAllocationPercent,
  formatDepositPct,
  formatFinancialAmount,
} from "@/lib/financials/types";
import type { InvestorFinancialsSummary, InvestorWageringStake } from "@/lib/financials/investor-summary";

type InvestorOverviewProps = {
  displayName: string;
};

export function InvestorOverview({ displayName }: InvestorOverviewProps) {
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
        setError(data.error ?? "Could not load your financial summary.");
        setLoading(false);
        return;
      }

      setSummary(data.summary ?? null);
    } catch {
      setError("Network error while loading your financial summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const equityStake = summary?.equityStake ?? null;
  const wageringStakes = summary?.wageringStakes ?? [];
  const hasAnyStake = Boolean(equityStake) || wageringStakes.length > 0;

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
      ) : !hasAnyStake ? (
        <div className="rounded-2xl border border-border bg-surface px-6 py-8">
          <p className="text-sm font-medium text-foreground">No stakes assigned yet</p>
          <p className="mt-2 text-sm text-muted">
            Your equity and wagering stake details will appear here once your administrator adds
            them.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
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
          </section>
        </div>
      )}

      <p className="text-sm text-muted">
        View full details on{" "}
        <Link href="/investor/financials" className="text-accent hover:underline">
          Financials
        </Link>
        .
      </p>
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
