import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import type { EquityStakeholder } from "@/lib/financials/types";
import { PROFILE_COLUMNS_WITH_SUSPENSION } from "@/lib/users/types";
import { createClient } from "@/lib/supabase/server";

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
    .from("profiles")
    .select(PROFILE_COLUMNS_WITH_SUSPENSION)
    .in("tier", ["investor", "admin"])
    .is("suspended_at", null)
    .order("tier", { ascending: true })
    .order("email", { ascending: true });

  if (error) {
    console.error("Stakeholders fetch failed:", error);
    return NextResponse.json({ error: "Could not load stakeholders." }, { status: 500 });
  }

  const stakeholders = ((data ?? []) as EquityStakeholder[]).filter(
    (profile) => profile.tier === "admin" || profile.registered_at,
  );

  return NextResponse.json({ stakeholders });
}
