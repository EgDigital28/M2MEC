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

export type ExpenseEntry = {
  id: string;
  cost_center_id: string;
  component_id: string;
  amount: number;
  expense_date: string;
  quarter: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  cost_center?: Pick<ExpenseCostCenter, "id" | "name"> | null;
  component?: Pick<ExpenseComponent, "id" | "name"> | null;
};

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
  return [...items].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}
