import { NextResponse } from "next/server";
import {
  isBetStatus,
  withComputedFields,
  type BetEntryRow,
} from "@/lib/bets/calculations";
import { requireMinimumTier } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

type UpdateBetPayload = {
  status?: string;
  event_date?: string;
  sport_id?: string;
  event_name?: string;
  line?: number | string;
  risk?: number | string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    if (auth.error === "unauthenticated") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { id } = await params;
  let body: UpdateBetPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const updates: Record<string, string | number> = {
    updated_at: new Date().toISOString(),
  };

  if (body.status !== undefined) {
    if (!isBetStatus(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    updates.status = body.status;
  }

  if (body.event_date !== undefined) updates.event_date = body.event_date.trim();
  if (body.sport_id !== undefined) updates.sport_id = body.sport_id.trim();
  if (body.event_name !== undefined) updates.event_name = body.event_name.trim();

  if (body.line !== undefined) {
    const line = Math.trunc(Number(body.line));
    if (Number.isNaN(line) || line === 0) {
      return NextResponse.json(
        { error: "Line must be a non-zero whole number." },
        { status: 400 },
      );
    }

    updates.line = line;
  }

  if (body.risk !== undefined) {
    const risk = Number(body.risk);
    if (Number.isNaN(risk) || risk <= 0) {
      return NextResponse.json({ error: "Invalid risk." }, { status: 400 });
    }

    updates.risk = Math.round(risk * 100) / 100;
  }

  const supabase = await createClient();
  const existing = await supabase.from("bet_entries").select("ledger_entity_id").eq("id",id).maybeSingle();
  if(existing.error) return NextResponse.json({error:"Could not check entry."},{status:503});
  if(existing.data?.ledger_entity_id) return NextResponse.json({error:"Ledger bets are read-only. Grading and corrections come from Ledger."},{status:403});

  const { data, error } = await supabase
    .from("bet_entries")
    .update(updates)
    .eq("id", id).is("ledger_entity_id",null)
    .select("*, sports(abbreviation, full_name)")
    .single();

  if (error) {
    console.error("Bet entry update failed:", error);
    return NextResponse.json({ error: "Could not update entry." }, { status: 500 });
  }

  return NextResponse.json({ entry: withComputedFields(data as BetEntryRow) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    if (auth.error === "unauthenticated") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const existing = await supabase.from("bet_entries").select("ledger_entity_id").eq("id",id).maybeSingle();
  if(existing.error) return NextResponse.json({error:"Could not check entry."},{status:503});
  if(existing.data?.ledger_entity_id) return NextResponse.json({error:"Ledger bets are read-only. Grading and corrections come from Ledger."},{status:403});

  const { error } = await supabase.from("bet_entries").delete().eq("id", id).is("ledger_entity_id",null);

  if (error) {
    console.error("Bet entry delete failed:", error);
    return NextResponse.json({ error: "Could not delete entry." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
