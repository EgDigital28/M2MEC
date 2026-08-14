import { quarterSortKey } from "@/lib/expenses/summaries";
import type {
  ExpenseComponent,
  ExpenseCostCenter,
  ExpenseEntry,
  ExpenseStatus,
} from "@/lib/expenses/types";
import { getLocalTodayDateString } from "@/lib/expenses/types";

export type ExpenseTimingFilter = "all" | "past" | "forecast";

export type ExpenseSortKey =
  | "cost_center"
  | "component"
  | "amount"
  | "date"
  | "quarter"
  | "status";

export type ExpenseSort = {
  key: ExpenseSortKey;
  direction: "asc" | "desc";
};

export type ExpenseFilters = {
  costCenterId: string;
  componentId: string;
  dateFrom: string;
  dateTo: string;
  timing: ExpenseTimingFilter;
};

export const EMPTY_EXPENSE_FILTERS: ExpenseFilters = {
  costCenterId: "",
  componentId: "",
  dateFrom: "",
  dateTo: "",
  timing: "all",
};

export const DEFAULT_EXPENSE_SORT: ExpenseSort = {
  key: "date",
  direction: "desc",
};

function getCostCenterName(
  entry: ExpenseEntry,
  costCenters: ExpenseCostCenter[],
) {
  const joined = entry.cost_center;
  if (joined && !Array.isArray(joined)) {
    return joined.name;
  }

  return costCenters.find((item) => item.id === entry.cost_center_id)?.name ?? "";
}

function getComponentName(entry: ExpenseEntry, components: ExpenseComponent[]) {
  const joined = entry.component;
  if (joined && !Array.isArray(joined)) {
    return joined.name;
  }

  return components.find((item) => item.id === entry.component_id)?.name ?? "";
}

export function isForecastExpenseDate(date: string, today = getLocalTodayDateString()) {
  return date.slice(0, 10) > today;
}

export function filterExpenseEntries(
  entries: ExpenseEntry[],
  filters: ExpenseFilters,
  today = getLocalTodayDateString(),
) {
  return entries.filter((entry) => {
    const date = entry.expense_date.slice(0, 10);

    if (filters.costCenterId && entry.cost_center_id !== filters.costCenterId) {
      return false;
    }

    if (filters.componentId && entry.component_id !== filters.componentId) {
      return false;
    }

    if (filters.dateFrom && date < filters.dateFrom) {
      return false;
    }

    if (filters.dateTo && date > filters.dateTo) {
      return false;
    }

    if (filters.timing === "past" && isForecastExpenseDate(date, today)) {
      return false;
    }

    if (filters.timing === "forecast" && !isForecastExpenseDate(date, today)) {
      return false;
    }

    return true;
  });
}

export function sortExpenseEntries(
  entries: ExpenseEntry[],
  sort: ExpenseSort,
  costCenters: ExpenseCostCenter[],
  components: ExpenseComponent[],
) {
  const direction = sort.direction === "asc" ? 1 : -1;

  return [...entries].sort((a, b) => {
    let comparison = 0;

    switch (sort.key) {
      case "cost_center":
        comparison = getCostCenterName(a, costCenters).localeCompare(
          getCostCenterName(b, costCenters),
        );
        break;
      case "component":
        comparison = getComponentName(a, components).localeCompare(getComponentName(b, components));
        break;
      case "amount":
        comparison = a.amount - b.amount;
        break;
      case "date":
        comparison = a.expense_date.localeCompare(b.expense_date);
        break;
      case "quarter":
        comparison = quarterSortKey(a.quarter) - quarterSortKey(b.quarter);
        break;
      case "status":
        comparison = a.status.localeCompare(b.status);
        break;
    }

    if (comparison !== 0) {
      return comparison * direction;
    }

    return b.expense_date.localeCompare(a.expense_date);
  });
}

export function toggleExpenseSort(current: ExpenseSort, key: ExpenseSortKey): ExpenseSort {
  if (current.key === key) {
    return {
      key,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }

  return {
    key,
    direction: key === "date" || key === "amount" ? "desc" : "asc",
  };
}

export function parseExpenseStatus(value: string | undefined): ExpenseStatus | null {
  if (!value) {
    return null;
  }

  if (value === "invoiced" || value === "paid" || value === "forecasted" || value === "void") {
    return value;
  }

  return null;
}
