import type { UserTier } from "@/lib/tiers";

export type TeamNavItem = {
  label: string;
  href: string;
  adminOnly?: boolean;
};

export const teamNavItems: TeamNavItem[] = [
  { label: "Overview", href: "/team" },
  { label: "Ledger", href: "/team/bets" },
  { label: "Expenses", href: "/team/expenses", adminOnly: true },
  { label: "Financials", href: "/team/financials", adminOnly: true },
  { label: "Sports", href: "/team/sports", adminOnly: true },
  { label: "Users", href: "/team/users", adminOnly: true },
  { label: "Waitlist", href: "/team/waitlist", adminOnly: true },
  { label: "Invites", href: "/team/invite" },
];

export function getTeamNavItems(tier: UserTier) {
  return teamNavItems.filter((item) => !item.adminOnly || tier === "admin");
}
