"use client";

import { useMemo } from "react";
import {
  computeComponentFiscalYearSummary,
  computeCostCenterQuarterSummary,
  getSummaryFiscalYears,
  getSummaryQuarters,
} from "@/lib/expenses/summaries";
import {
  formatExpenseAmount,
  type ExpenseComponent,
  type ExpenseCostCenter,
  type ExpenseEntry,
} from "@/lib/expenses/types";

type ExpenseSummaryTablesProps = {
  entries: ExpenseEntry[];
  costCenters: ExpenseCostCenter[];
  components: ExpenseComponent[];
};

const moneyCellClassName = "whitespace-nowrap text-right font-mono tabular-nums";

function SummaryAmount({ amount, muted = false }: { amount: number; muted?: boolean }) {
  return (
    <span className={amount === 0 || muted ? "text-muted/70" : undefined}>
      {formatExpenseAmount(amount)}
    </span>
  );
}

function SummaryTable({
  labelColumn,
  columns,
  summary,
}: {
  labelColumn: string;
  columns: string[];
  summary: ReturnType<typeof computeCostCenterQuarterSummary>;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-border bg-surface-elevated text-left text-muted">
            <th className="sticky left-0 z-10 bg-surface-elevated px-3 py-2.5 font-medium">
              {labelColumn}
            </th>
            <th className={`${moneyCellClassName} px-3 py-2.5 font-semibold text-foreground`}>
              Total
            </th>
            {columns.map((column) => (
              <th key={column} className={`${moneyCellClassName} px-3 py-2.5 font-medium`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summary.rows.map((row) => (
            <tr key={row.id} className="border-b border-border/60">
              <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium">{row.name}</td>
              <td className={`${moneyCellClassName} px-3 py-2 font-semibold`}>
                <SummaryAmount amount={row.total} muted={row.total === 0} />
              </td>
              {columns.map((column) => (
                <td key={column} className={`${moneyCellClassName} px-3 py-2`}>
                  <SummaryAmount amount={row.values[column] ?? 0} />
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-border bg-surface-elevated/60 font-semibold">
            <td className="sticky left-0 z-10 bg-surface-elevated/60 px-3 py-2">Total</td>
            <td className={`${moneyCellClassName} px-3 py-2`}>
              <SummaryAmount amount={summary.grandTotal} />
            </td>
            {columns.map((column) => (
              <td key={column} className={`${moneyCellClassName} px-3 py-2`}>
                <SummaryAmount amount={summary.columnTotals[column] ?? 0} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ExpenseSummaryTables({
  entries,
  costCenters,
  components,
}: ExpenseSummaryTablesProps) {
  const quarters = useMemo(() => getSummaryQuarters(entries), [entries]);
  const fiscalYears = useMemo(() => getSummaryFiscalYears(quarters), [quarters]);

  const costCenterSummary = useMemo(
    () => computeCostCenterQuarterSummary(entries, costCenters, quarters),
    [entries, costCenters, quarters],
  );

  const componentSummary = useMemo(
    () => computeComponentFiscalYearSummary(entries, components, fiscalYears),
    [entries, components, fiscalYears],
  );

  if (costCenters.length === 0 && components.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <SummaryTable
        labelColumn="Cost Center"
        columns={quarters}
        summary={costCenterSummary}
      />
      <SummaryTable
        labelColumn="Component"
        columns={fiscalYears}
        summary={componentSummary}
      />
    </div>
  );
}
