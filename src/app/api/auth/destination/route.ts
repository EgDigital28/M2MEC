import { NextResponse } from "next/server";
import { getDefaultDestination } from "@/lib/auth/destination";
import { getCurrentProfile } from "@/lib/auth/profile";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next");
  const safeNext =
    next?.startsWith("/") && !next.startsWith("//") ? next : "/";

  const profile = await getCurrentProfile();

  if (!profile) {
    return NextResponse.json({ destination: "/login" });
  }

  return NextResponse.json({
    destination: getDefaultDestination(profile.tier, safeNext),
  });
}
