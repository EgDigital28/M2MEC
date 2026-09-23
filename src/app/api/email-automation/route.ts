import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { AUTOMATED_EMAILS, isAutomatedEmailType } from "@/lib/email/automation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Turns one automated email on or off. Takes effect at its next check. */
export async function PATCH(request: Request) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  let body: { emailType?: unknown; enabled?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isAutomatedEmailType(body.emailType) || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Choose an email and on or off." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_automation_settings")
    .upsert({
      email_type: body.emailType,
      enabled: body.enabled,
      updated_by: auth.profile.id,
      updated_at: new Date().toISOString(),
    })
    .select("email_type, enabled, updated_at")
    .single();

  if (error) {
    console.error("email-automation.toggle_failed", error.message);
    return NextResponse.json({ error: "Could not save the switch." }, { status: 500 });
  }

  return NextResponse.json({
    type: data.email_type,
    label: AUTOMATED_EMAILS[body.emailType].label,
    enabled: data.enabled,
    updatedAt: data.updated_at,
  });
}
