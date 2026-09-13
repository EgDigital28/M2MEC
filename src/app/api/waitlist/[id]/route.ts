import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { isWaitlistStatus, type WaitlistSubmission } from "@/lib/waitlist/types";

type PatchPayload = {
  status?: string;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMinimumTier("admin");

    if ("error" in auth) {
      if (auth.error === "unauthenticated") {
        return NextResponse.json({ error: "Sign in required." }, { status: 401 });
      }

      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { id } = await context.params;

    let body: PatchPayload;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const status = body.status?.trim();

    if (!status || !isWaitlistStatus(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("waitlist_submissions")
      .update({ status })
      .eq("id", id)
      .select("id, email, name, message, status, welcome_email_sent_at, created_at")
      .maybeSingle();

    if (error) {
      console.error("Waitlist update failed:", error);
      return NextResponse.json({ error: "Could not update submission." }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    return NextResponse.json({ submission: data as WaitlistSubmission });
  } catch (error) {
    console.error("Waitlist patch failed:", error);
    return NextResponse.json({ error: "Could not update submission." }, { status: 500 });
  }
}
