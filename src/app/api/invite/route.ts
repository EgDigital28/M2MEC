import { NextResponse } from "next/server";
import {
  existingAccountMessage,
  isInvitableTier,
  tierConflictMessage,
} from "@/lib/auth/invite-rules";
import { requireMinimumTier } from "@/lib/auth/profile";
import {
  inviteEmailHtml,
  inviteEmailSubject,
  inviteEmailText,
} from "@/lib/email/invite";
import { getResendClient, getResendFromEmail } from "@/lib/email/utils";
import { SERVICE_ROLE_MISSING_MESSAGE, tryCreateAdminClient } from "@/lib/supabase/admin";
import { isUserTier, TIER_LABELS, type UserTier } from "@/lib/tiers";

const INVITE_TIERS: UserTier[] = ["a", "b", "employee", "investor"];

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

  if (!isInvitableTier(tier)) {
    return NextResponse.json({ error: "Invalid tier." }, { status: 400 });
  }

  if (tier === "employee" && auth.profile.tier !== "admin") {
    return NextResponse.json(
      { error: "Only admins can invite with employee tier." },
      { status: 403 },
    );
  }

  const admin = tryCreateAdminClient();

  if (!admin) {
    return NextResponse.json({ error: SERVICE_ROLE_MISSING_MESSAGE }, { status: 503 });
  }

  const resend = getResendClient();

  if (!resend) {
    return NextResponse.json({ error: "Email service is not configured." }, { status: 500 });
  }

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

  const profileSelect = await admin
    .from("profiles")
    .select("id, email, tier, registered_at")
    .ilike("email", email)
    .maybeSingle();

  let existingProfile = profileSelect.data;
  const existingProfileError = profileSelect.error;

  if (existingProfileError?.message?.includes("registered_at")) {
    const legacySelect = await admin
      .from("profiles")
      .select("id, email, tier, created_at")
      .ilike("email", email)
      .maybeSingle();

    if (legacySelect.error) {
      console.error("Invite profile lookup failed:", legacySelect.error);
      return NextResponse.json({ error: "Could not validate invite." }, { status: 500 });
    }

    existingProfile = legacySelect.data
      ? { ...legacySelect.data, registered_at: legacySelect.data.created_at }
      : null;
  } else if (existingProfileError) {
    console.error("Invite profile lookup failed:", existingProfileError);
    return NextResponse.json({ error: "Could not validate invite." }, { status: 500 });
  }

  if (existingProfile) {
    if (existingProfile.tier !== tier) {
      return NextResponse.json(
        { error: tierConflictMessage(existingProfile.tier) },
        { status: 400 },
      );
    }

    if (existingProfile.registered_at) {
      return NextResponse.json(
        { error: existingAccountMessage(existingProfile.tier) },
        { status: 400 },
      );
    }
  }

  const origin = getSiteOrigin(request);
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/set-password")}`;

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });

  if (linkError) {
    console.error("Invite link generation failed:", linkError);

    const message =
      linkError.message.includes("already been registered") ||
      linkError.message.includes("already registered")
        ? "That email already has an account."
        : "Could not create invite. Try again.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const hashedToken = linkData.properties?.hashed_token;
  const verificationType = linkData.properties?.verification_type ?? "invite";

  const callbackParams = new URLSearchParams({
    token_hash: hashedToken ?? "",
    type: verificationType,
    next: "/set-password",
  });
  const actionLink = `${origin}/auth/callback?${callbackParams.toString()}`;

  if (!hashedToken || !linkData.user) {
    console.error("Invite link missing hashed_token or user:", linkData);
    return NextResponse.json({ error: "Could not create invite link." }, { status: 500 });
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ tier, email })
    .eq("id", linkData.user.id);

  if (profileError) {
    console.error("Profile tier update failed:", profileError);
    return NextResponse.json({ error: "Could not assign access tier." }, { status: 500 });
  }

  const emailParams = { tier, actionLink };

  const { error: emailError } = await resend.emails.send({
    from: getResendFromEmail(),
    to: email,
    subject: inviteEmailSubject(emailParams),
    html: inviteEmailHtml(emailParams),
    text: inviteEmailText(emailParams),
  });

  if (emailError) {
    console.error("Invite email failed:", emailError);
    return NextResponse.json(
      { error: "Account created, but the invite email could not be sent." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    email,
    tier,
    tierLabel: TIER_LABELS[tier],
  });
}
