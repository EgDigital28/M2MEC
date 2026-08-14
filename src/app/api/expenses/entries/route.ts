import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { parseExpenseStatus } from "@/lib/expenses/filters";
import type { ExpenseEntry } from "@/lib/expenses/types";
import { defaultExpenseStatusForDate } from "@/lib/expenses/types";
import { createClient } from "@/lib/supabase/server";

const ENTRY_SELECT = `
  id,
  cost_center_id,
  component_id,
  amount,
  expense_date,
  quarter,
  status,
  notes,
  created_at,
  updated_at,
  cost_center:expense_cost_centers ( id, name ),
  component:expense_components ( id, name )
`;

type CreatePayload = {
  cost_center_id?: string;
  component_id?: string;
  amount?: number | string;
  expense_date?: string;
  status?: string;
  notes?: string;
};

function parseAmount(value: number | string | undefined) {
  if (value === undefined || value === "") {
    return null;
  }

  const amount = typeof value === "number" ? value : Number(String(value).replace(/[,$]/g, ""));

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return amount;
}

export async function GET() {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_entries")
    .select(ENTRY_SELECT)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Expense entries fetch failed:", error);

    if (error.message.includes("expense_entries")) {
      return NextResponse.json(
        {
          error: "Expense tracking is not set up. Run 010_expenses.sql in Supabase.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Could not load expense entries." }, { status: 500 });
  }

  return NextResponse.json({ entries: data as unknown as ExpenseEntry[] });
}

export async function POST(request: Request) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  let body: CreatePayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const amount = parseAmount(body.amount);
  const expenseDate = body.expense_date?.trim();

  if (!body.cost_center_id || !body.component_id || amount === null || !expenseDate) {
    return NextResponse.json(
      { error: "Cost center, component, amount, and date are required." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const status =
    parseExpenseStatus(body.status) ?? defaultExpenseStatusForDate(expenseDate);

  const { data, error } = await supabase
    .from("expense_entries")
    .insert({
      cost_center_id: body.cost_center_id,
      component_id: body.component_id,
      amount,
      expense_date: expenseDate,
      status,
      notes: body.notes?.trim() || null,
      quarter: "1Q00",
    })
    .select(ENTRY_SELECT)
    .single();

  if (error) {
    console.error("Expense entry create failed:", error);
    return NextResponse.json({ error: "Could not create expense entry." }, { status: 500 });
  }

  return NextResponse.json({ entry: data as unknown as ExpenseEntry });
}
