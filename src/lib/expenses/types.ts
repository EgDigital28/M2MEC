import { sortBySortOrder } from "@/lib/sort";

export type ExpenseCostCenter = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
};

export type ExpenseComponent = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
};

export const EXPENSE_STATUSES = ["invoiced", "paid", "forecasted", "void"] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  invoiced: "Invoiced",
  paid: "Paid",
  forecasted: "Forecasted",
  void: "Void",
};

export type ExpenseEntry = {
  id: string;
  cost_center_id: string;
  component_id: string;
  amount: number;
  expense_date: string;
  quarter: string;
  status: ExpenseStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  cost_center?: Pick<ExpenseCostCenter, "id" | "name"> | null;
  component?: Pick<ExpenseComponent, "id" | "name"> | null;
};

export function defaultExpenseStatusForDate(date: string): ExpenseStatus {
  const normalized = date.slice(0, 10);
  return normalized > getLocalTodayDateString() ? "forecasted" : "invoiced";
}

export function isSummaryEligible(entry: Pick<ExpenseEntry, "status">) {
  return entry.status !== "void";
}

export function expenseStatusBadgeClass(status: ExpenseStatus) {
  switch (status) {
    case "paid":
      return "border-emerald-500/30 text-emerald-300";
    case "forecasted":
      return "border-accent/30 text-accent";
    case "void":
      return "border-red-500/30 text-red-300";
    default:
      return "border-amber-500/30 text-amber-200";
  }
}

/** Local calendar date as YYYY-MM-DD for `<input type="date">`. */
export function getLocalTodayDateString() {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

export function getQuarterFromDate(dateInput: string | Date) {
  const date =
    typeof dateInput === "string"
      ? new Date(`${dateInput.slice(0, 10)}T00:00:00`)
      : dateInput;

  const month = date.getMonth() + 1;
  const year = date.getFullYear() % 100;
  const quarter = Math.floor((month - 1) / 3) + 1;

  return `${quarter}Q${year.toString().padStart(2, "0")}`;
}

export function formatExpenseAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatExpenseInput(value: string) {
  const sanitized = value.replace(/,/g, "").replace(/[^\d]/g, "");

  if (!sanitized) {
    return "";
  }

  return sanitized.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function parseExpenseAmount(value: string) {
  return Number.parseFloat(value.replace(/,/g, "")) || Number.NaN;
}

export function sortCatalog<T extends { sort_order: number; name: string }>(items: T[]) {
  return sortBySortOrder(items, (a, b) => a.name.localeCompare(b.name));
}
