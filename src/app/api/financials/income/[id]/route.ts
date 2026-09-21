import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import {
  validateIncomePayload,
  type IncomeContract,
  type IncomeContractPayload,
} from "@/lib/financials/income";
import { createClient } from "@/lib/supabase/server";

const COLUMNS =
  "id, name, counterparty, annual_amount, start_date, end_date, is_active, notes, created_at";

async function requireAdmin() {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  let body: IncomeContractPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = validateIncomePayload(body);

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("income_contracts")
    .update({ ...parsed.values, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(COLUMNS)
    .single();

  if (error) {
    console.error("Income contract update failed:", error.message);
    return NextResponse.json({ error: "Could not update the contract." }, { status: 500 });
  }

  return NextResponse.json({ contract: data as IncomeContract });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("income_contracts").delete().eq("id", id);

  if (error) {
    console.error("Income contract delete failed:", error.message);
    return NextResponse.json({ error: "Could not delete the contract." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
