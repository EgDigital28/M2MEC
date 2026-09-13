import { NextResponse } from "next/server";
import {
  withComputedFields,
  type BetEntryRow,
} from "@/lib/bets/calculations";
import { requireMinimumTier } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

type CreateBetPayload = {
  event_date?: string;
  sport_id?: string;
  event_name?: string;
  line?: number | string;
  risk?: number | string;
};

export async function GET() {
  const auth = await requireMinimumTier("employee");

  if ("error" in auth) {
    if (auth.error === "unauthenticated") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bet_entries")
    .select("*, sports(abbreviation, full_name)")
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Bet entries fetch failed:", error);
    return NextResponse.json({ error: "Could not load entries." }, { status: 500 });
  }

  const entries = (data as BetEntryRow[]).map((row) => withComputedFields(row));

  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    if (auth.error === "unauthenticated") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let body: CreateBetPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const event_date = body.event_date?.trim();
  const sport_id = body.sport_id?.trim();
  const event_name = body.event_name?.trim();
  const line = Math.trunc(Number(body.line));
  const risk = Number(body.risk);

  if (!event_date || !sport_id || !event_name) {
    return NextResponse.json(
      { error: "Date, sport, and event are required." },
      { status: 400 },
    );
  }

  if (Number.isNaN(line) || line === 0) {
    return NextResponse.json(
      { error: "Line must be a non-zero whole number." },
      { status: 400 },
    );
  }

  if (Number.isNaN(risk) || risk <= 0) {
    return NextResponse.json({ error: "Risk must be greater than zero." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bet_entries")
    .insert({
      created_by: auth.profile.id,
      event_date,
      sport_id,
      event_name,
      line: Math.trunc(line),
      risk: Math.round(risk * 100) / 100,
      status: "Open",
    })
    .select("*, sports(abbreviation, full_name)")
    .single();

  if (error) {
    console.error("Bet entry create failed:", error);
    return NextResponse.json({ error: "Could not create entry." }, { status: 500 });
  }

  return NextResponse.json({ entry: withComputedFields(data as BetEntryRow) });
}
