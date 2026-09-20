import type { UserTier } from "@/lib/tiers";

export type TeamNavItem = {
  label: string;
  href: string;
  adminOnly?: boolean;
};

export const teamNavItems: TeamNavItem[] = [
  { label: "Overview", href: "/team" },
  { label: "Ledger", href: "/team/bets" },
  // "Prediction Ledger" is inserted here by TeamShell for allowlisted viewers.
  { label: "Reports", href: "/team/reports" },
];

export function getTeamNavItems(tier: UserTier) {
  return teamNavItems.filter((item) => !item.adminOnly || tier === "admin");
}
