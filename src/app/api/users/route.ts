import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import {
  isMissingSuspensionColumn,
  PROFILE_COLUMNS,
  PROFILE_COLUMNS_WITH_SUSPENSION,
  withSuspendedAt,
  type ManagedUser,
} from "@/lib/users/types";

export type { ManagedUser };

export async function GET() {
  try {
    const auth = await requireMinimumTier("admin");

    if ("error" in auth) {
      if (auth.error === "unauthenticated") {
        return NextResponse.json({ error: "Sign in required." }, { status: 401 });
      }

      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const supabase = await createClient();
    const withSuspension = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS_WITH_SUSPENSION)
      .order("created_at", { ascending: false });

    if (withSuspension.error && isMissingSuspensionColumn(withSuspension.error.message)) {
      const withoutSuspension = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .order("created_at", { ascending: false });

      if (withoutSuspension.error) {
        console.error("Users fetch failed:", withoutSuspension.error);
        return NextResponse.json({ error: "Could not load users." }, { status: 500 });
      }

      const users = (withoutSuspension.data ?? []).map((profile) => withSuspendedAt(profile));

      return NextResponse.json({
        users,
        migrationRequired: true,
      });
    }

    if (withSuspension.error) {
      console.error("Users fetch failed:", withSuspension.error);

      if (withSuspension.error.message.includes("policy")) {
        return NextResponse.json(
          {
            error:
              "Admin profile access is not set up. Run 006_admin_profile_policies.sql in Supabase.",
          },
          { status: 503 },
        );
      }

      return NextResponse.json({ error: "Could not load users." }, { status: 500 });
    }

    return NextResponse.json({ users: withSuspension.data as ManagedUser[] });
  } catch (error) {
    console.error("Users route failed:", error);
    return NextResponse.json({ error: "Could not load users." }, { status: 500 });
  }
}
