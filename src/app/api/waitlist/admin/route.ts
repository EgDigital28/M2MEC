import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type { WaitlistSubmission } from "@/lib/waitlist/types";

export async function GET() {
  try {
    const auth = await requireMinimumTier("admin");

    if ("error" in auth) {
      if (auth.error === "unauthenticated") {
        return NextResponse.json({ error: "Sign in required." }, { status: 401 });
      }

      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("waitlist_submissions")
      .select("id, email, name, message, status, welcome_email_sent_at, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Waitlist fetch failed:", error);

      if (error.message.includes("policy")) {
        return NextResponse.json(
          {
            error:
              "Waitlist admin access is not set up. Run 009_admin_waitlist_invites.sql in Supabase.",
          },
          { status: 503 },
        );
      }

      return NextResponse.json({ error: "Could not load waitlist." }, { status: 500 });
    }

    return NextResponse.json({ submissions: data as WaitlistSubmission[] });
  } catch (error) {
    console.error("Waitlist route failed:", error);
    return NextResponse.json({ error: "Could not load waitlist." }, { status: 500 });
  }
}
