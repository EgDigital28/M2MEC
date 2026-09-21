import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import {
  DEPOSIT_COLUMNS,
  validateDeposit,
  type CapitalDeposit,
  type DepositPayload,
} from "@/lib/financials/deposits";
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
    .from("capital_deposits")
    .select(DEPOSIT_COLUMNS)
    .order("deposited_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Deposits fetch failed:", error.message);

    if (error.message.includes("capital_deposits")) {
      return NextResponse.json(
        { error: "Deposits are not set up. Run 027_capital_deposits.sql." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Could not load deposits." }, { status: 500 });
  }

  return NextResponse.json({ deposits: data as unknown as CapitalDeposit[] });
}

export async function POST(request: Request) {
  const auth = await requireMinimumTier("admin");
  if ("error" in auth) return denied(auth.error);

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
    .insert({ ...parsed.values, created_by: auth.profile.id })
    .select(DEPOSIT_COLUMNS)
    .single();

  if (error) {
    console.error("Deposit create failed:", error.message);
    return NextResponse.json({ error: "Could not add the deposit." }, { status: 500 });
  }

  return NextResponse.json({ deposit: data as unknown as CapitalDeposit });
}
