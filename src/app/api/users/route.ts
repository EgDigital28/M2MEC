import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserTier } from "@/lib/tiers";

export type ManagedUser = {
  id: string;
  email: string;
  display_name: string | null;
  tier: UserTier;
  created_at: string;
  suspended_at: string | null;
};

export async function GET() {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    if (auth.error === "unauthenticated") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, display_name, tier, created_at, suspended_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Users fetch failed:", error);
    return NextResponse.json({ error: "Could not load users." }, { status: 500 });
  }

  return NextResponse.json({ users: data as ManagedUser[] });
}
