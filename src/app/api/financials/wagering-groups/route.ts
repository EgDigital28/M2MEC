import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { sortWageringGroups, type WageringStakeGroup } from "@/lib/financials/wagering";
import { createClient } from "@/lib/supabase/server";

type CreatePayload = {
  name?: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

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
    .from("wagering_stake_groups")
    .select("id, name, description, sort_order, is_active, created_at, updated_at")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Wagering groups fetch failed:", error);

    if (error.message.includes("wagering_stake_groups")) {
      return NextResponse.json(
        { error: "Wagering groups are not set up. Run 017_wagering_stakes.sql in Supabase." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Could not load wagering groups." }, { status: 500 });
  }

  return NextResponse.json({ groups: sortWageringGroups(data as WageringStakeGroup[]) });
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

  const name = body.name?.trim();
  const description = body.description?.trim() || null;

  if (!name) {
    return NextResponse.json({ error: "Group name is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wagering_stake_groups")
    .insert({
      name,
      description,
      sort_order: body.sort_order ?? 0,
      is_active: body.is_active ?? true,
    })
    .select("id, name, description, sort_order, is_active, created_at, updated_at")
    .single();

  if (error) {
    console.error("Wagering group create failed:", error);

    if (error.code === "23505") {
      return NextResponse.json({ error: "A group with this name already exists." }, { status: 400 });
    }

    return NextResponse.json({ error: "Could not create wagering group." }, { status: 500 });
  }

  return NextResponse.json({ group: data as WageringStakeGroup });
}
