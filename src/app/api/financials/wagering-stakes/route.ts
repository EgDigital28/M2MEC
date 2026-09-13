import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { fetchOverallPl } from "@/lib/financials/ledger-summary";
import { normalizeStakeProfileId, type WageringStake } from "@/lib/financials/wagering";
import { createClient } from "@/lib/supabase/server";

const STAKE_SELECT = `
  id,
  profile_id,
  group_id,
  capital_deposit,
  created_at,
  updated_at,
  profile:profiles ( id, email, display_name, report_alias, tier ),
  group:wagering_stake_groups ( id, name, description )
`;

type CreatePayload = {
  profile_id?: string | null;
  group_id?: string;
  capital_deposit?: number | string;
};

function parseMoney(value: number | string | undefined) {
  if (value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[,$]/g, ""));

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

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
    .from("wagering_stakes")
    .select(STAKE_SELECT)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Wagering stakes fetch failed:", error);

    if (error.message.includes("wagering_stakes")) {
      return NextResponse.json(
        { error: "Wagering stakes are not set up. Run 017_wagering_stakes.sql in Supabase." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Could not load wagering stakes." }, { status: 500 });
  }

  try {
    const ledger = await fetchOverallPl();

    return NextResponse.json({
      stakes: data as unknown as WageringStake[],
      overallPl: ledger.overallPl,
      totalProfitLoss: ledger.totalProfitLoss,
    });
  } catch (ledgerError) {
    console.error("Ledger summary fetch failed:", ledgerError);
    return NextResponse.json({ error: "Could not load ledger summary." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  let body: CreatePayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const profileId = normalizeStakeProfileId(body.profile_id);
  const capitalDeposit = parseMoney(body.capital_deposit);

  if (!body.group_id || capitalDeposit === null) {
    return NextResponse.json(
      { error: "Group and capital deposit are required." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wagering_stakes")
    .insert({
      profile_id: profileId,
      group_id: body.group_id,
      capital_deposit: capitalDeposit,
    })
    .select(STAKE_SELECT)
    .single();

  if (error) {
    console.error("Wagering stake create failed:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This investor already has a wagering stake in that group." },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: "Could not create wagering stake." }, { status: 500 });
  }

  return NextResponse.json({ stake: data as unknown as WageringStake });
}
