import type { Profile } from "@/lib/auth/profile";

export function getProfileDisplayName(profile: Profile): string {
  if (profile.display_name?.trim()) {
    return profile.display_name.trim();
  }

  return profile.email.split("@")[0] ?? profile.email;
}
