import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { parseExpenseStatus } from "@/lib/expenses/filters";
import type { ExpenseEntry } from "@/lib/expenses/types";
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

type PatchPayload = {
  cost_center_id?: string;
  component_id?: string;
  amount?: number | string;
  expense_date?: string;
  status?: string;
  notes?: string | null;
};

function parseAmount(value: number | string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === "") {
    return null;
  }

  const amount = typeof value === "number" ? value : Number(String(value).replace(/[,$]/g, ""));

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return amount;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  const { id } = await context.params;

  let body: PatchPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const updates: Record<string, string | number | null> = {};

  if (body.cost_center_id !== undefined) {
    updates.cost_center_id = body.cost_center_id;
  }

  if (body.component_id !== undefined) {
    updates.component_id = body.component_id;
  }

  if (body.amount !== undefined) {
    const amount = parseAmount(body.amount);
    if (amount === null || amount === undefined) {
      return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
    }
    updates.amount = amount;
  }

  if (body.expense_date !== undefined) {
    const expenseDate = body.expense_date.trim();
    if (!expenseDate) {
      return NextResponse.json({ error: "Date is required." }, { status: 400 });
    }
    updates.expense_date = expenseDate;
  }

  if (body.notes !== undefined) {
    updates.notes = body.notes?.trim() || null;
  }

  if (body.status !== undefined) {
    const status = parseExpenseStatus(body.status);
    if (!status) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    updates.status = status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_entries")
    .update(updates)
    .eq("id", id)
    .select(ENTRY_SELECT)
    .maybeSingle();

  if (error) {
    console.error("Expense entry update failed:", error);
    return NextResponse.json({ error: "Could not update expense entry." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Expense entry not found." }, { status: 404 });
  }

  return NextResponse.json({ entry: data as unknown as ExpenseEntry });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  const { id } = await context.params;
  const supabase = await createClient();
  const { error } = await supabase.from("expense_entries").delete().eq("id", id);

  if (error) {
    console.error("Expense entry delete failed:", error);
    return NextResponse.json({ error: "Could not delete expense entry." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
