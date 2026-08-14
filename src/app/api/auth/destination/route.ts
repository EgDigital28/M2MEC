import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { hasMinimumTier } from "@/lib/tiers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next");
  const safeNext =
    next?.startsWith("/") && !next.startsWith("//") ? next : "/";

  const profile = await getCurrentProfile();

  if (!profile) {
    return NextResponse.json({ destination: "/login" });
  }

  if (safeNext !== "/") {
    return NextResponse.json({ destination: safeNext });
  }

  if (hasMinimumTier(profile.tier, "employee")) {
    return NextResponse.json({ destination: "/team" });
  }

  return NextResponse.json({ destination: "/account" });
}
