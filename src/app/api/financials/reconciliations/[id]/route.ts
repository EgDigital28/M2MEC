import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import {
  RECONCILIATION_COLUMNS,
  validateReconciliation,
  type BettingReconciliation,
  type ReconciliationPayload,
} from "@/lib/financials/reconciliations";
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
  let body: ReconciliationPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = validateReconciliation(body);

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("betting_reconciliations")
    .update({ ...parsed.values, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(RECONCILIATION_COLUMNS)
    .single();

  if (error) {
    console.error("Reconciliation update failed:", error.message);
    return NextResponse.json({ error: "Could not update the entry." }, { status: 500 });
  }

  return NextResponse.json({
    reconciliation: data as unknown as BettingReconciliation,
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const deniedResponse = await requireAdmin();
  if (deniedResponse) return deniedResponse;

  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("betting_reconciliations").delete().eq("id", id);

  if (error) {
    console.error("Reconciliation delete failed:", error.message);
    return NextResponse.json({ error: "Could not delete the entry." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
