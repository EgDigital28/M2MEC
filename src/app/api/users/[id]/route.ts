import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    if (auth.error === "unauthenticated") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { id } = await context.params;

  if (id === auth.profile.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: targetProfile, error: profileError } = await admin
    .from("profiles")
    .select("id, email, tier")
    .eq("id", id)
    .maybeSingle();

  if (profileError) {
    console.error("User lookup failed:", profileError);
    return NextResponse.json({ error: "Could not load user." }, { status: 500 });
  }

  if (!targetProfile) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(id);

  if (deleteError) {
    console.error("User delete failed:", deleteError);
    return NextResponse.json({ error: "Could not delete user." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email: targetProfile.email });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    if (auth.error === "unauthenticated") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { id } = await context.params;

  if (id === auth.profile.id) {
    return NextResponse.json({ error: "You cannot suspend your own account." }, { status: 400 });
  }

  let body: { action?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.action !== "suspend" && body.action !== "unsuspend") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: targetProfile, error: profileError } = await admin
    .from("profiles")
    .select("id, email, suspended_at")
    .eq("id", id)
    .maybeSingle();

  if (profileError) {
    console.error("User lookup failed:", profileError);
    return NextResponse.json({ error: "Could not load user." }, { status: 500 });
  }

  if (!targetProfile) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const email = targetProfile.email.trim().toLowerCase();

  if (body.action === "suspend") {
    const suspendedAt = new Date().toISOString();

    const { error: profileUpdateError } = await admin
      .from("profiles")
      .update({ suspended_at: suspendedAt, updated_at: suspendedAt })
      .eq("id", id);

    if (profileUpdateError) {
      console.error("Profile suspend failed:", profileUpdateError);
      return NextResponse.json({ error: "Could not suspend user." }, { status: 500 });
    }

    const { error: blockError } = await admin.from("suspended_emails").upsert(
      {
        email,
        suspended_at: suspendedAt,
        suspended_by: auth.profile.id,
      },
      { onConflict: "email" },
    );

    if (blockError) {
      console.error("Suspended email upsert failed:", blockError);
      return NextResponse.json({ error: "Could not suspend user." }, { status: 500 });
    }

    const { error: banError } = await admin.auth.admin.updateUserById(id, {
      ban_duration: "876000h",
    });

    if (banError) {
      console.error("User ban failed:", banError);
      return NextResponse.json({ error: "Could not suspend user." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action: "suspend", email });
  }

  const { error: profileUpdateError } = await admin
    .from("profiles")
    .update({ suspended_at: null, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (profileUpdateError) {
    console.error("Profile unsuspend failed:", profileUpdateError);
    return NextResponse.json({ error: "Could not unsuspend user." }, { status: 500 });
  }

  const { error: unblockError } = await admin
    .from("suspended_emails")
    .delete()
    .ilike("email", email);

  if (unblockError) {
    console.error("Suspended email delete failed:", unblockError);
    return NextResponse.json({ error: "Could not unsuspend user." }, { status: 500 });
  }

  const { error: unbanError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: "none",
  });

  if (unbanError) {
    console.error("User unban failed:", unbanError);
    return NextResponse.json({ error: "Could not unsuspend user." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action: "unsuspend", email });
}
