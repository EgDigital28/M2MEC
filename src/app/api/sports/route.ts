import { NextResponse } from "next/server";
import type { Sport } from "@/lib/sports/types";
import { requireMinimumTier } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

type CreateSportPayload = {
  abbreviation?: string;
  full_name?: string;
  is_active?: boolean;
  sort_order?: number;
};

export async function GET(request: Request) {
  const auth = await requireMinimumTier("employee");

  if ("error" in auth) {
    if (auth.error === "unauthenticated") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") === "true";

  const supabase = await createClient();
  let query = supabase
    .from("sports")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("abbreviation", { ascending: true });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Sports fetch failed:", error);
    return NextResponse.json({ error: "Could not load sports." }, { status: 500 });
  }

  return NextResponse.json({ sports: data as Sport[] });
}

export async function POST(request: Request) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    if (auth.error === "unauthenticated") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let body: CreateSportPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const abbreviation = body.abbreviation?.trim();
  const full_name = body.full_name?.trim();

  if (!abbreviation || !full_name) {
    return NextResponse.json(
      { error: "Abbreviation and full name are required." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sports")
    .insert({
      abbreviation,
      full_name,
      is_active: body.is_active ?? true,
      sort_order: body.sort_order ?? 0,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Sport create failed:", error);
    const message = error.code === "23505"
      ? "That abbreviation already exists."
      : "Could not create sport.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ sport: data as Sport });
}
