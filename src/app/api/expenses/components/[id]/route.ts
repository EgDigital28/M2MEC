import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import type { ExpenseComponent } from "@/lib/expenses/types";
import { createClient } from "@/lib/supabase/server";

type PatchPayload = {
  name?: string;
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

  const updates: Record<string, string | number | boolean> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    }
    updates.name = name;
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

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_components")
    .update(updates)
    .eq("id", id)
    .select("id, name, sort_order, is_active, created_at")
    .maybeSingle();

  if (error) {
    console.error("Component update failed:", error);
    return NextResponse.json({ error: "Could not update component." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Component not found." }, { status: 404 });
  }

  return NextResponse.json({ component: data as ExpenseComponent });
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
    .from("expense_entries")
    .select("id", { count: "exact", head: true })
    .eq("component_id", id);

  if (countError) {
    console.error("Component usage check failed:", countError);
    return NextResponse.json({ error: "Could not delete component." }, { status: 500 });
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "This component is used by expense entries. Deactivate it instead." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("expense_components").delete().eq("id", id);

  if (error) {
    console.error("Component delete failed:", error);
    return NextResponse.json({ error: "Could not delete component." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
