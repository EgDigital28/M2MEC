import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import {
  isMissingRegistrationColumn,
  isMissingSuspensionColumn,
  PROFILE_BASE_COLUMNS,
  PROFILE_COLUMNS,
  PROFILE_COLUMNS_WITH_SUSPENSION,
  withRegisteredAtFallback,
  withSuspendedAt,
} from "@/lib/users/types";
import type { InviteActivityRow } from "@/lib/invites/types";

type InviteEventSummary = {
  email: string;
  created_at: string;
};

function summarizeInviteEvents(events: InviteEventSummary[]) {
  const summary = new Map<string, { count: number; last: string }>();

  for (const event of events) {
    const key = event.email.toLowerCase();
    const existing = summary.get(key);

    if (!existing) {
      summary.set(key, { count: 1, last: event.created_at });
      continue;
    }

    existing.count += 1;

    if (event.created_at > existing.last) {
      existing.last = event.created_at;
    }
  }

  return summary;
}

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

    const profilesResult = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS_WITH_SUSPENSION)
      .order("created_at", { ascending: false });

    let profiles = profilesResult.data ?? [];
    let migrationRequired = false;

    if (profilesResult.error && isMissingSuspensionColumn(profilesResult.error.message)) {
      const fallback = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .order("created_at", { ascending: false });

      if (fallback.error) {
        console.error("Invites profile fetch failed:", fallback.error);
        return NextResponse.json({ error: "Could not load invite activity." }, { status: 500 });
      }

      profiles = (fallback.data ?? []).map((profile) => withSuspendedAt(profile));
      migrationRequired = true;
    } else if (
      profilesResult.error &&
      isMissingRegistrationColumn(profilesResult.error.message)
    ) {
      const fallback = await supabase
        .from("profiles")
        .select(`${PROFILE_BASE_COLUMNS}, suspended_at`)
        .order("created_at", { ascending: false });

      if (fallback.error) {
        console.error("Invites profile fetch failed:", fallback.error);
        return NextResponse.json({ error: "Could not load invite activity." }, { status: 500 });
      }

      profiles = (fallback.data ?? []).map((profile) =>
        withRegisteredAtFallback({ ...profile, registered_at: profile.created_at }),
      );
      migrationRequired = true;
    } else if (profilesResult.error) {
      console.error("Invites profile fetch failed:", profilesResult.error);
      return NextResponse.json({ error: "Could not load invite activity." }, { status: 500 });
    }

    const eventsResult = await supabase
      .from("invite_events")
      .select("email, created_at")
      .order("created_at", { ascending: false });

    if (eventsResult.error && !eventsResult.error.message.includes("invite_events")) {
      console.error("Invite events fetch failed:", eventsResult.error);
    }

    if (eventsResult.error?.message.includes("invite_events")) {
      migrationRequired = true;
    }

    const eventSummary = summarizeInviteEvents(eventsResult.data ?? []);

    const invites: InviteActivityRow[] = profiles.map((profile) => {
      const summary = eventSummary.get(profile.email.toLowerCase());

      return {
        profile_id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
        tier: profile.tier,
        invited_at: profile.created_at,
        registered_at: profile.registered_at ?? null,
        suspended_at: profile.suspended_at ?? null,
        invite_count: summary?.count ?? 1,
        last_invited_at: summary?.last ?? profile.created_at,
      };
    });

    return NextResponse.json({ invites, migrationRequired });
  } catch (error) {
    console.error("Invites route failed:", error);
    return NextResponse.json({ error: "Could not load invite activity." }, { status: 500 });
  }
}
