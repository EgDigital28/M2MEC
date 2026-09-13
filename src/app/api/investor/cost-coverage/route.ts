import { NextResponse } from "next/server";
import { requireInvestorTier } from "@/lib/auth/investor";
import { fetchOverallPl } from "@/lib/financials/ledger-summary";
import { computeCostCoverage } from "@/lib/expenses/summaries";
import type { ExpenseEntry } from "@/lib/expenses/types";
import { SERVICE_ROLE_MISSING_MESSAGE, tryCreateAdminClient } from "@/lib/supabase/admin";

const ENTRY_SELECT = `
  id,
  amount,
  expense_date,
  quarter,
  status
`;

export async function GET() {
  const auth = await requireInvestorTier();

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Investor access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  const admin = tryCreateAdminClient();

  if (!admin) {
    return NextResponse.json({ error: SERVICE_ROLE_MISSING_MESSAGE }, { status: 503 });
  }

  const { data, error } = await admin.from("expense_entries").select(ENTRY_SELECT);

  if (error) {
    console.error("Investor cost coverage fetch failed:", error);

    if (error.message.includes("expense_entries")) {
      return NextResponse.json(
        { error: "Expense tracking is not set up yet." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Could not load cost coverage." }, { status: 500 });
  }

  try {
    const ledger = await fetchOverallPl();

    const { data: equityStakes, error: equityError } = await admin
      .from("equity_stakes")
      .select("deposit");

    if (equityError && !equityError.message.includes("equity_stakes")) {
      console.error("Investor equity deposits fetch failed:", equityError);
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

    return NextResponse.json({ summary });
  } catch (ledgerError) {
    console.error("Investor ledger summary fetch failed:", ledgerError);
    return NextResponse.json({ error: "Could not load ledger summary." }, { status: 500 });
  }
}
