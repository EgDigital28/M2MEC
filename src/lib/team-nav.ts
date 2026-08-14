import type { UserTier } from "@/lib/tiers";

export type TeamNavItem = {
  label: string;
  href: string;
  adminOnly?: boolean;
};

export const teamNavItems: TeamNavItem[] = [
  { label: "Overview", href: "/team" },
  { label: "Bets", href: "/team/bets" },
  { label: "Sports", href: "/team/sports", adminOnly: true },
  { label: "Users", href: "/team/users", adminOnly: true },
  { label: "Invite", href: "/team/invite" },
];

export function getTeamNavItems(tier: UserTier) {
  return teamNavItems.filter((item) => !item.adminOnly || tier === "admin");
}
