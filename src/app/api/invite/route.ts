import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUserTier, type UserTier } from "@/lib/tiers";

const INVITE_TIERS: UserTier[] = ["b", "a", "employee"];

type InvitePayload = {
  email?: string;
  tier?: string;
};

function getSiteOrigin(request: Request) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    new URL(request.url).origin
  );
}

export async function POST(request: Request) {
  const auth = await requireMinimumTier("employee");

  if ("error" in auth) {
    if (auth.error === "unauthenticated") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Not authorized to send invites." },
      { status: 403 },
    );
  }

  let body: InvitePayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const tier = body.tier?.trim() ?? "b";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }

  if (!isUserTier(tier) || !INVITE_TIERS.includes(tier)) {
    return NextResponse.json({ error: "Invalid tier." }, { status: 400 });
  }

  // Only admins can grant employee tier or above via invite.
  if (tier === "employee" && auth.profile.tier !== "admin") {
    return NextResponse.json(
      { error: "Only admins can invite with employee tier." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  const { data: suspendedEmail } = await admin
    .from("suspended_emails")
    .select("email")
    .ilike("email", email)
    .maybeSingle();

  if (suspendedEmail) {
    return NextResponse.json(
      { error: "That email is suspended and cannot be invited." },
      { status: 400 },
    );
  }

  const origin = getSiteOrigin(request);
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/set-password")}`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (error) {
    console.error("Invite failed:", error);

    const message =
      error.message.includes("already been registered") ||
      error.message.includes("already registered")
        ? "That email already has an account."
        : "Could not send invite. Try again.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (data.user) {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ tier, email })
      .eq("id", data.user.id);

    if (profileError) {
      console.error("Profile tier update failed:", profileError);
    }
  }

  return NextResponse.json({ ok: true, email });
}
