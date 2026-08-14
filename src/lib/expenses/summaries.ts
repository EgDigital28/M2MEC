import { sortCatalog, type ExpenseComponent, type ExpenseCostCenter, type ExpenseEntry } from "./types";

export const DEFAULT_SUMMARY_QUARTERS = [
  "1Q26",
  "2Q26",
  "3Q26",
  "4Q26",
  "1Q27",
  "2Q27",
  "3Q27",
  "4Q27",
] as const;

export const DEFAULT_SUMMARY_FISCAL_YEARS = ["FY26", "FY27"] as const;

export type SummaryRow = {
  id: string;
  name: string;
  sortOrder: number;
  total: number;
  values: Record<string, number>;
};

export type ExpenseSummary = {
  rows: SummaryRow[];
  columnTotals: Record<string, number>;
  grandTotal: number;
};

function parseQuarterKey(quarter: string) {
  const match = /^(\d)Q(\d{2})$/.exec(quarter);
  if (!match) {
    return null;
  }

  return { quarter: Number(match[1]), year: Number(match[2]) };
}

function quarterSortKey(quarter: string) {
  const parsed = parseQuarterKey(quarter);
  if (!parsed) {
    return Number.MAX_SAFE_INTEGER;
  }

  return parsed.year * 10 + parsed.quarter;
}

export function quarterToFiscalYear(quarter: string) {
  const parsed = parseQuarterKey(quarter);
  if (!parsed) {
    return null;
  }

  return `FY${parsed.year.toString().padStart(2, "0")}`;
}

export function getSummaryQuarters(entries: ExpenseEntry[]) {
  const quarters = new Set<string>(DEFAULT_SUMMARY_QUARTERS);

  for (const entry of entries) {
    quarters.add(entry.quarter);
  }

  return [...quarters].sort((a, b) => quarterSortKey(a) - quarterSortKey(b));
}

export function getSummaryFiscalYears(quarters: string[]) {
  const fiscalYears = new Set<string>(DEFAULT_SUMMARY_FISCAL_YEARS);

  for (const quarter of quarters) {
    const fiscalYear = quarterToFiscalYear(quarter);
    if (fiscalYear) {
      fiscalYears.add(fiscalYear);
    }
  }

  return [...fiscalYears].sort();
}

function buildEmptyValues(columns: string[]) {
  return Object.fromEntries(columns.map((column) => [column, 0]));
}

function finalizeSummary(
  rows: SummaryRow[],
  columns: string[],
): ExpenseSummary {
  const columnTotals = buildEmptyValues(columns);
  let grandTotal = 0;

  for (const row of rows) {
    grandTotal += row.total;

    for (const column of columns) {
      columnTotals[column] += row.values[column] ?? 0;
    }
  }

  return { rows, columnTotals, grandTotal };
}

export function computeCostCenterQuarterSummary(
  entries: ExpenseEntry[],
  costCenters: ExpenseCostCenter[],
  quarters: string[],
): ExpenseSummary {
  const valuesByCenter = new Map(
    costCenters.map((center) => [center.id, buildEmptyValues(quarters)]),
  );

  for (const entry of entries) {
    const values = valuesByCenter.get(entry.cost_center_id);
    if (!values) {
      continue;
    }

    values[entry.quarter] = (values[entry.quarter] ?? 0) + entry.amount;
  }

  const rows = sortCatalog(costCenters).map((center) => {
    const values = valuesByCenter.get(center.id) ?? buildEmptyValues(quarters);
    const total = Object.values(values).reduce((sum, amount) => sum + amount, 0);

    return {
      id: center.id,
      name: center.name,
      sortOrder: center.sort_order,
      total,
      values,
    };
  });

  return finalizeSummary(rows, quarters);
}

export function computeComponentFiscalYearSummary(
  entries: ExpenseEntry[],
  components: ExpenseComponent[],
  fiscalYears: string[],
): ExpenseSummary {
  const valuesByComponent = new Map(
    components.map((component) => [component.id, buildEmptyValues(fiscalYears)]),
  );

  for (const entry of entries) {
    const fiscalYear = quarterToFiscalYear(entry.quarter);
    if (!fiscalYear) {
      continue;
    }

    const values = valuesByComponent.get(entry.component_id);
    if (!values) {
      continue;
    }

    values[fiscalYear] = (values[fiscalYear] ?? 0) + entry.amount;
  }

  const rows = sortCatalog(components).map((component) => {
    const values = valuesByComponent.get(component.id) ?? buildEmptyValues(fiscalYears);
    const total = Object.values(values).reduce((sum, amount) => sum + amount, 0);

    return {
      id: component.id,
      name: component.name,
      sortOrder: component.sort_order,
      total,
      values,
    };
  });

  return finalizeSummary(rows, fiscalYears);
}
