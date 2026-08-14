import type { UserTier } from "@/lib/tiers";

export type TeamNavItem = {
  label: string;
  href: string;
  minimumTier?: UserTier;
};

export const teamNavItems: TeamNavItem[] = [
  { label: "Overview", href: "/team" },
  { label: "Invite", href: "/team/invite" },
];

export function getTeamNavItems(tier: UserTier) {
  return teamNavItems.filter(
    (item) =>
      !item.minimumTier ||
      tier === item.minimumTier ||
      tier === "admin",
  );
}
