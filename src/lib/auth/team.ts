import { redirect } from "next/navigation";
import { requireMinimumTier, type Profile } from "@/lib/auth/profile";

export async function requireTeamProfile(loginNext = "/team"): Promise<Profile> {
  const result = await requireMinimumTier("employee");

  if ("error" in result) {
    if (result.error === "unauthenticated") {
      redirect(`/login?next=${loginNext}`);
    }

    redirect("/");
  }

  return result.profile;
}
