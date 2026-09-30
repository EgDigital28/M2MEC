import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";

/** Every creative route is admin-only and answers the same way when it is not. */
export async function requireCreativeAdmin() {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return {
      response: NextResponse.json(
        { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
        { status: auth.error === "unauthenticated" ? 401 : 403 },
      ),
    };
  }

  return { profile: auth.profile };
}
