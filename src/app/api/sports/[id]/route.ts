import { NextResponse } from "next/server";
import type { Sport, SportPayload } from "@/lib/sports/types";
import { requireMinimumTier } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    if (auth.error === "unauthenticated") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { id } = await params;
  let body: SportPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const updates: Record<string, string | number | boolean> = {
    updated_at: new Date().toISOString(),
  };

  if (body.abbreviation !== undefined) {
    const abbreviation = body.abbreviation.trim();
    if (!abbreviation) {
      return NextResponse.json({ error: "Abbreviation is required." }, { status: 400 });
    }

    updates.abbreviation = abbreviation;
  }

  if (body.full_name !== undefined) {
    const full_name = body.full_name.trim();
    if (!full_name) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }

    updates.full_name = full_name;
  }

  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sports")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Sport update failed:", error);
    const message = error.code === "23505"
      ? "That abbreviation already exists."
      : "Could not update sport.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ sport: data as Sport });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    if (auth.error === "unauthenticated") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("sports").delete().eq("id", id);

  if (error) {
    console.error("Sport delete failed:", error);
    const message = error.code === "23503"
      ? "This sport is used by bet entries and cannot be deleted."
      : "Could not delete sport.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
