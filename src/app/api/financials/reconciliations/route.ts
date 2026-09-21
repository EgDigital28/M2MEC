import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import {
  RECONCILIATION_COLUMNS,
  validateReconciliation,
  type BettingReconciliation,
  type ReconciliationPayload,
} from "@/lib/financials/reconciliations";
import { createClient } from "@/lib/supabase/server";

function denied(error: "unauthenticated" | "forbidden") {
  return NextResponse.json(
    { error: error === "unauthenticated" ? "Sign in required." : "Admin access required." },
    { status: error === "unauthenticated" ? 401 : 403 },
  );
}

export async function GET() {
  const auth = await requireMinimumTier("admin");
  if ("error" in auth) return denied(auth.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("betting_reconciliations")
    .select(RECONCILIATION_COLUMNS)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Reconciliations fetch failed:", error.message);

    if (error.code === "42P01" || error.code === "PGRST205") {
      return NextResponse.json(
        { error: "Reconciliations are not set up. Run 026_betting_reconciliations.sql." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: `Could not load reconciliations: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    reconciliations: data as unknown as BettingReconciliation[],
  });
}

export async function POST(request: Request) {
  const auth = await requireMinimumTier("admin");
  if ("error" in auth) return denied(auth.error);

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
    .insert({ ...parsed.values, created_by: auth.profile.id })
    .select(RECONCILIATION_COLUMNS)
    .single();

  if (error) {
    console.error("Reconciliation create failed:", error.message);
    return NextResponse.json({ error: "Could not add the entry." }, { status: 500 });
  }

  return NextResponse.json({
    reconciliation: data as unknown as BettingReconciliation,
  });
}
