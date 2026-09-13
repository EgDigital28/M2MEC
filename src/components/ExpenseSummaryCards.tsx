"use client";

import { useMemo } from "react";
import { computeExpenseSummaryMetrics } from "@/lib/expenses/summaries";
import { formatExpenseAmount, type ExpenseEntry } from "@/lib/expenses/types";

type ExpenseSummaryCardsProps = {
  entries: ExpenseEntry[];
};

export function ExpenseSummaryCards({ entries }: ExpenseSummaryCardsProps) {
  const metrics = useMemo(() => computeExpenseSummaryMetrics(entries), [entries]);

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-border bg-surface-elevated p-5">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">YTD Expenses</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">
          {formatExpenseAmount(metrics.ytdExpenses)}
        </p>
        <p className="mt-1 text-xs text-muted">Paid in {metrics.currentYear}</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface-elevated p-5">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">Year Forecast</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">
          {formatExpenseAmount(metrics.yearForecast)}
        </p>
        <p className="mt-1 text-xs text-muted">All non-void in {metrics.currentYear}</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface-elevated p-5">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">
          Outstanding Yearly Obligation
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">
          {formatExpenseAmount(metrics.yearlyObligation)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {metrics.currentYear} · invoiced & forecasted
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface-elevated p-5">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">
          Quarterly Obligation
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">
          {formatExpenseAmount(metrics.quarterlyObligation)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {metrics.currentQuarter} · invoiced & forecasted
        </p>
      </div>
    </section>
  );
}
