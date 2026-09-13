import { redirect } from "next/navigation";
import { getCurrentProfile, type Profile } from "@/lib/auth/profile";

export async function requireInvestorProfile(loginNext = "/investor"): Promise<Profile> {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect(`/login?next=${loginNext}`);
  }

  if (profile.tier !== "investor") {
    redirect("/");
  }

  if (profile.suspended_at) {
    redirect("/");
  }

  return profile;
}

export async function requireInvestorTier(): Promise<
  { profile: Profile } | { error: "unauthenticated" | "forbidden" }
> {
  const profile = await getCurrentProfile();

  if (!profile) {
    return { error: "unauthenticated" };
  }

  if (profile.tier !== "investor" || profile.suspended_at) {
    return { error: "forbidden" };
  }

  return { profile };
}
