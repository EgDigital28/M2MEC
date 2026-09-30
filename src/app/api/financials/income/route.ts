import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import {
  validateIncomePayload,
  type IncomeContract,
  type IncomeContractPayload,
} from "@/lib/financials/income";
import { createClient } from "@/lib/supabase/server";

const COLUMNS =
  "id, name, counterparty, annual_amount, tax_rate, start_date, end_date, is_active, notes, created_at";

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
    .from("income_contracts")
    .select(COLUMNS)
    .order("start_date", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Income contracts fetch failed:", error.message);

    if (error.message.includes("income_contracts")) {
      return NextResponse.json(
        { error: "Income is not set up. Run 023_income_contracts.sql in Supabase." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Could not load income contracts." }, { status: 500 });
  }

  return NextResponse.json({ contracts: data as IncomeContract[] });
}

export async function POST(request: Request) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

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
    .insert({ ...parsed.values, created_by: auth.profile.id })
    .select(COLUMNS)
    .single();

  if (error) {
    console.error("Income contract create failed:", error.message);
    return NextResponse.json({ error: "Could not add the contract." }, { status: 500 });
  }

  return NextResponse.json({ contract: data as IncomeContract });
}
