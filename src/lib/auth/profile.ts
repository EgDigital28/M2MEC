import { createClient } from "@/lib/supabase/server";
import {
  isMissingSuspensionColumn,
  PROFILE_COLUMNS,
  PROFILE_COLUMNS_WITH_SUSPENSION,
  withSuspendedAt,
} from "@/lib/users/types";
import { hasMinimumTier, type UserTier } from "@/lib/tiers";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  tier: UserTier;
  suspended_at: string | null;
};

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS_WITH_SUSPENSION)
    .eq("id", user.id)
    .single();

  if (error && isMissingSuspensionColumn(error.message)) {
    const { data: fallbackProfile } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", user.id)
      .single();

    return fallbackProfile ? withSuspendedAt(fallbackProfile) : null;
  }

  return profile;
}

export function isProfileSuspended(profile: Pick<Profile, "suspended_at"> | null | undefined) {
  return Boolean(profile?.suspended_at);
}

export async function requireMinimumTier(
  requiredTier: UserTier,
): Promise<{ profile: Profile } | { error: "unauthenticated" | "forbidden" }> {
  const profile = await getCurrentProfile();

  if (!profile) {
    return { error: "unauthenticated" };
  }

  if (!hasMinimumTier(profile.tier, requiredTier)) {
    return { error: "forbidden" };
  }

  if (isProfileSuspended(profile)) {
    return { error: "forbidden" };
  }

  return { profile };
}
