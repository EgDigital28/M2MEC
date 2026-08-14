import { createClient } from "@/lib/supabase/server";
import { hasMinimumTier, type UserTier } from "@/lib/tiers";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  tier: UserTier;
};

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, display_name, tier")
    .eq("id", user.id)
    .single();

  return profile;
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

  return { profile };
}
