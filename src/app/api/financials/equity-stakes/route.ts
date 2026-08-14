import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { validateAllocationTotal, normalizeStakeProfileId, type EquityStake } from "@/lib/financials/types";
import { createClient } from "@/lib/supabase/server";

const STAKE_SELECT = `
  id,
  profile_id,
  io_allocation,
  io_cash_value,
  deposit,
  created_at,
  updated_at,
  profile:profiles ( id, email, display_name, tier )
`;

type CreatePayload = {
  profile_id?: string | null;
  io_allocation?: number | string;
  io_cash_value?: number | string;
  deposit?: number | string;
};

function parsePercent(value: number | string | undefined) {
  if (value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));

  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
    return null;
  }

  return parsed;
}

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
    .from("equity_stakes")
    .select(STAKE_SELECT)
    .order("io_allocation", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Equity stakes fetch failed:", error);

    if (error.message.includes("equity_stakes")) {
      return NextResponse.json(
        { error: "Equity stakes are not set up. Run 014_equity_stakes.sql in Supabase." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Could not load equity stakes." }, { status: 500 });
  }

  return NextResponse.json({ stakes: data as unknown as EquityStake[] });
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
  const ioAllocation = parsePercent(body.io_allocation);
  const ioCashValue = parseMoney(body.io_cash_value);
  const deposit = parseMoney(body.deposit ?? 0);

  if (ioAllocation === null || ioCashValue === null || deposit === null) {
    return NextResponse.json(
      { error: "IO allocation, IO cash value, and deposit are required." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { data: existingRows, error: existingError } = await supabase
    .from("equity_stakes")
    .select("id, io_allocation");

  if (existingError) {
    console.error("Equity stakes validation fetch failed:", existingError);
    return NextResponse.json({ error: "Could not validate allocation total." }, { status: 500 });
  }

  const allocationCheck = validateAllocationTotal(existingRows ?? [], ioAllocation);

  if (!allocationCheck.ok) {
    return NextResponse.json({ error: allocationCheck.message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("equity_stakes")
    .insert({
      profile_id: profileId,
      io_allocation: ioAllocation,
      io_cash_value: ioCashValue,
      deposit,
    })
    .select(STAKE_SELECT)
    .single();

  if (error) {
    console.error("Equity stake create failed:", error);

    if (error.code === "23505") {
      return NextResponse.json({ error: "This investor already has an equity stake." }, { status: 400 });
    }

    return NextResponse.json({ error: "Could not create equity stake." }, { status: 500 });
  }

  return NextResponse.json({ stake: data as unknown as EquityStake });
}
