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

type PatchPayload = {
  profile_id?: string | null;
  io_allocation?: number | string;
  io_cash_value?: number | string;
  deposit?: number | string;
};

function parsePercent(value: number | string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));

  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
    return null;
  }

  return parsed;
}

function parseMoney(value: number | string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[,$]/g, ""));

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  const { id } = await context.params;

  let body: PatchPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const updates: Record<string, string | number | null> = {};

  if (body.profile_id !== undefined) {
    updates.profile_id = normalizeStakeProfileId(body.profile_id);
  }

  if (body.io_allocation !== undefined) {
    const ioAllocation = parsePercent(body.io_allocation);
    if (ioAllocation === null || ioAllocation === undefined) {
      return NextResponse.json({ error: "Invalid IO allocation." }, { status: 400 });
    }
    updates.io_allocation = ioAllocation;
  }

  if (body.io_cash_value !== undefined) {
    const ioCashValue = parseMoney(body.io_cash_value);
    if (ioCashValue === null || ioCashValue === undefined) {
      return NextResponse.json({ error: "Invalid IO cash value." }, { status: 400 });
    }
    updates.io_cash_value = ioCashValue;
  }

  if (body.deposit !== undefined) {
    const deposit = parseMoney(body.deposit);
    if (deposit === null || deposit === undefined) {
      return NextResponse.json({ error: "Invalid deposit." }, { status: 400 });
    }
    updates.deposit = deposit;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  const supabase = await createClient();

  if (updates.io_allocation !== undefined) {
    const { data: existingRows, error: existingError } = await supabase
      .from("equity_stakes")
      .select("id, io_allocation");

    if (existingError) {
      console.error("Equity stakes validation fetch failed:", existingError);
      return NextResponse.json({ error: "Could not validate allocation total." }, { status: 500 });
    }

    const allocationCheck = validateAllocationTotal(
      existingRows ?? [],
      Number(updates.io_allocation),
      id,
    );

    if (!allocationCheck.ok) {
      return NextResponse.json({ error: allocationCheck.message }, { status: 400 });
    }
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("equity_stakes")
    .update(updates)
    .eq("id", id)
    .select(STAKE_SELECT)
    .maybeSingle();

  if (error) {
    console.error("Equity stake update failed:", error);

    if (error.code === "23505") {
      return NextResponse.json({ error: "This investor already has an equity stake." }, { status: 400 });
    }

    return NextResponse.json({ error: "Could not update equity stake." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Equity stake not found." }, { status: 404 });
  }

  return NextResponse.json({ stake: data as unknown as EquityStake });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  const { id } = await context.params;
  const supabase = await createClient();
  const { error } = await supabase.from("equity_stakes").delete().eq("id", id);

  if (error) {
    console.error("Equity stake delete failed:", error);
    return NextResponse.json({ error: "Could not delete equity stake." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
