import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import type { WageringStakeGroup } from "@/lib/financials/wagering";
import { createClient } from "@/lib/supabase/server";

type PatchPayload = {
  name?: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

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

  const updates: Record<string, string | number | boolean | null> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Group name cannot be empty." }, { status: 400 });
    }
    updates.name = name;
  }

  if (body.description !== undefined) {
    updates.description = body.description?.trim() || null;
  }

  if (body.sort_order !== undefined) {
    updates.sort_order = body.sort_order;
  }

  if (body.is_active !== undefined) {
    updates.is_active = body.is_active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wagering_stake_groups")
    .update(updates)
    .eq("id", id)
    .select("id, name, description, sort_order, is_active, created_at, updated_at")
    .maybeSingle();

  if (error) {
    console.error("Wagering group update failed:", error);

    if (error.code === "23505") {
      return NextResponse.json({ error: "A group with this name already exists." }, { status: 400 });
    }

    return NextResponse.json({ error: "Could not update wagering group." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Wagering group not found." }, { status: 404 });
  }

  return NextResponse.json({ group: data as WageringStakeGroup });
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

  const { count, error: countError } = await supabase
    .from("wagering_stakes")
    .select("id", { count: "exact", head: true })
    .eq("group_id", id);

  if (countError) {
    console.error("Wagering group usage check failed:", countError);
    return NextResponse.json({ error: "Could not delete wagering group." }, { status: 500 });
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "This group is used by wagering stakes. Archive it instead." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("wagering_stake_groups").delete().eq("id", id);

  if (error) {
    console.error("Wagering group delete failed:", error);
    return NextResponse.json({ error: "Could not delete wagering group." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
