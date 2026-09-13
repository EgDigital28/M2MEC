import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
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

type PatchPayload = {
  profile_id?: string | null;
  group_id?: string;
  capital_deposit?: number | string;
};

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

  if (body.group_id !== undefined) {
    updates.group_id = body.group_id;
  }

  if (body.capital_deposit !== undefined) {
    const capitalDeposit = parseMoney(body.capital_deposit);
    if (capitalDeposit === null || capitalDeposit === undefined) {
      return NextResponse.json({ error: "Invalid capital deposit." }, { status: 400 });
    }
    updates.capital_deposit = capitalDeposit;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wagering_stakes")
    .update(updates)
    .eq("id", id)
    .select(STAKE_SELECT)
    .maybeSingle();

  if (error) {
    console.error("Wagering stake update failed:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This investor already has a wagering stake in that group." },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: "Could not update wagering stake." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Wagering stake not found." }, { status: 404 });
  }

  return NextResponse.json({ stake: data as unknown as WageringStake });
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
  const { error } = await supabase.from("wagering_stakes").delete().eq("id", id);

  if (error) {
    console.error("Wagering stake delete failed:", error);
    return NextResponse.json({ error: "Could not delete wagering stake." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
