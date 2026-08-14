import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { SERVICE_ROLE_MISSING_MESSAGE, tryCreateAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isMissingSuspensionColumn } from "@/lib/users/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MIGRATION_ERROR =
  "User suspensions are not set up yet. Run 005_user_suspensions.sql in Supabase.";

const POLICY_ERROR =
  "Admin profile access is not set up. Run 006_admin_profile_policies.sql in Supabase.";

function migrationErrorFor(message: string | undefined) {
  if (isMissingSuspensionColumn(message)) {
    return MIGRATION_ERROR;
  }

  if (message?.includes("suspended_emails")) {
    return MIGRATION_ERROR;
  }

  if (message?.includes("policy")) {
    return POLICY_ERROR;
  }

  return null;
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireMinimumTier("admin");

    if ("error" in auth) {
      if (auth.error === "unauthenticated") {
        return NextResponse.json({ error: "Sign in required." }, { status: 401 });
      }

      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const admin = tryCreateAdminClient();

    if (!admin) {
      return NextResponse.json({ error: SERVICE_ROLE_MISSING_MESSAGE }, { status: 503 });
    }

    const { id } = await context.params;

    if (id === auth.profile.id) {
      return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: targetProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, tier")
      .eq("id", id)
      .maybeSingle();

    if (profileError) {
      console.error("User lookup failed:", profileError);
      return NextResponse.json(
        { error: migrationErrorFor(profileError.message) ?? "Could not load user." },
        { status: migrationErrorFor(profileError.message) ? 503 : 500 },
      );
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
  } catch (error) {
    console.error("User delete failed:", error);
    return NextResponse.json({ error: "Could not delete user." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
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

    const supabase = await createClient();
    const { data: targetProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, suspended_at")
      .eq("id", id)
      .maybeSingle();

    if (profileError) {
      console.error("User lookup failed:", profileError);
      return NextResponse.json(
        { error: migrationErrorFor(profileError.message) ?? "Could not load user." },
        { status: migrationErrorFor(profileError.message) ? 503 : 500 },
      );
    }

    if (!targetProfile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const email = targetProfile.email.trim().toLowerCase();
    const admin = tryCreateAdminClient();

    if (body.action === "suspend") {
      const suspendedAt = new Date().toISOString();

      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ suspended_at: suspendedAt, updated_at: suspendedAt })
        .eq("id", id);

      if (profileUpdateError) {
        console.error("Profile suspend failed:", profileUpdateError);
        return NextResponse.json(
          { error: migrationErrorFor(profileUpdateError.message) ?? "Could not suspend user." },
          { status: migrationErrorFor(profileUpdateError.message) ? 503 : 500 },
        );
      }

      const { error: blockError } = await supabase.from("suspended_emails").upsert(
        {
          email,
          suspended_at: suspendedAt,
          suspended_by: auth.profile.id,
        },
        { onConflict: "email" },
      );

      if (blockError) {
        console.error("Suspended email upsert failed:", blockError);
        return NextResponse.json(
          { error: migrationErrorFor(blockError.message) ?? "Could not suspend user." },
          { status: migrationErrorFor(blockError.message) ? 503 : 500 },
        );
      }

      if (!admin) {
        return NextResponse.json({ error: SERVICE_ROLE_MISSING_MESSAGE }, { status: 503 });
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

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ suspended_at: null, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (profileUpdateError) {
      console.error("Profile unsuspend failed:", profileUpdateError);
      return NextResponse.json(
        { error: migrationErrorFor(profileUpdateError.message) ?? "Could not unsuspend user." },
        { status: migrationErrorFor(profileUpdateError.message) ? 503 : 500 },
      );
    }

    const { error: unblockError } = await supabase
      .from("suspended_emails")
      .delete()
      .ilike("email", email);

    if (unblockError) {
      console.error("Suspended email delete failed:", unblockError);
      return NextResponse.json(
        { error: migrationErrorFor(unblockError.message) ?? "Could not unsuspend user." },
        { status: migrationErrorFor(unblockError.message) ? 503 : 500 },
      );
    }

    if (!admin) {
      return NextResponse.json({ error: SERVICE_ROLE_MISSING_MESSAGE }, { status: 503 });
    }

    const { error: unbanError } = await admin.auth.admin.updateUserById(id, {
      ban_duration: "none",
    });

    if (unbanError) {
      console.error("User unban failed:", unbanError);
      return NextResponse.json({ error: "Could not unsuspend user." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action: "unsuspend", email });
  } catch (error) {
    console.error("User update failed:", error);
    return NextResponse.json({ error: "Could not update user." }, { status: 500 });
  }
}
