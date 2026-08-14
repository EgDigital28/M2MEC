import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
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

    const admin = createAdminClient();
    const withSuspension = await admin
      .from("profiles")
      .select(PROFILE_COLUMNS_WITH_SUSPENSION)
      .order("created_at", { ascending: false });

    if (withSuspension.error && isMissingSuspensionColumn(withSuspension.error.message)) {
      const withoutSuspension = await admin
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
      return NextResponse.json({ error: "Could not load users." }, { status: 500 });
    }

    return NextResponse.json({ users: withSuspension.data as ManagedUser[] });
  } catch (error) {
    console.error("Users route failed:", error);
    const message =
      error instanceof Error && error.message.includes("SUPABASE_SERVICE_ROLE_KEY")
        ? "Server configuration error. Contact an admin."
        : "Could not load users.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
