import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import {
  DEPOSIT_COLUMNS,
  validateDeposit,
  type CapitalDeposit,
  type DepositPayload,
} from "@/lib/financials/deposits";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      {
        error:
          auth.error === "unauthenticated" ? "Sign in required." : "Admin access required.",
      },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  return null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const deniedResponse = await requireAdmin();
  if (deniedResponse) return deniedResponse;

  const { id } = await params;
  let body: DepositPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = validateDeposit(body);

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("capital_deposits")
    .update({ ...parsed.values, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(DEPOSIT_COLUMNS)
    .single();

  if (error) {
    console.error("Deposit update failed:", error.message);
    return NextResponse.json({ error: "Could not update the deposit." }, { status: 500 });
  }

  return NextResponse.json({ deposit: data as unknown as CapitalDeposit });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const deniedResponse = await requireAdmin();
  if (deniedResponse) return deniedResponse;

  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("capital_deposits").delete().eq("id", id);

  if (error) {
    console.error("Deposit delete failed:", error.message);
    return NextResponse.json({ error: "Could not delete the deposit." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
