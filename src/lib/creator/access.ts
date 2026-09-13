import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";

export const canViewCreatorFeed = cache(async () => {
  const profile = await getCurrentProfile();
  if (!profile || profile.tier !== "admin" || profile.suspended_at) return false;
  const db = await createClient();
  const { data, error } = await db.from("creator_feed_viewers").select("user_id").eq("user_id", profile.id).maybeSingle();
  // Fail closed during schema rollout or an unavailable authorization lookup.
  return !error && Boolean(data);
});
