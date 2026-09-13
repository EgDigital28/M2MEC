import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { fetchOverallPl } from "@/lib/financials/ledger-summary";
import { computeCostCoverage } from "@/lib/expenses/summaries";
import type { ExpenseEntry } from "@/lib/expenses/types";
import { createClient } from "@/lib/supabase/server";

const ENTRY_SELECT = `
  id,
  amount,
  expense_date,
  quarter,
  status
`;

export async function GET() {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("expense_entries").select(ENTRY_SELECT);

  if (error) {
    console.error("Cost coverage fetch failed:", error);

    if (error.message.includes("expense_entries")) {
      return NextResponse.json(
        { error: "Expense tracking is not set up. Run 010_expenses.sql in Supabase." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Could not load cost coverage." }, { status: 500 });
  }

  try {
    const ledger = await fetchOverallPl();

    const { data: equityStakes, error: equityError } = await supabase
      .from("equity_stakes")
      .select("deposit");

    if (equityError && !equityError.message.includes("equity_stakes")) {
      console.error("Equity stakes fetch failed:", equityError);
      return NextResponse.json({ error: "Could not load investor deposits." }, { status: 500 });
    }

    const investorDepositTotal = (equityStakes ?? []).reduce(
      (total, stake) => total + Number(stake.deposit ?? 0),
      0,
    );

    const summary = computeCostCoverage(
      (data ?? []) as ExpenseEntry[],
      ledger.overallPl,
      investorDepositTotal,
    );

    return NextResponse.json({ summary, overallPl: ledger.overallPl, investorDepositTotal });
  } catch (ledgerError) {
    console.error("Ledger summary fetch failed:", ledgerError);
    return NextResponse.json({ error: "Could not load ledger summary." }, { status: 500 });
  }
}
