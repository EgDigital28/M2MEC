"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Profile } from "@/lib/auth/profile";
import { getProfileDisplayName } from "@/lib/auth/display-name";
import { getTeamNavItems } from "@/lib/team-nav";
import { TIER_LABELS } from "@/lib/tiers";
import { TeamSignOut } from "@/components/TeamSignOut";

type TeamShellProps = {
  profile: Profile;
  creatorFeedAccess?: boolean;
  children: React.ReactNode;
};

export function TeamShell({ profile, children, creatorFeedAccess = false }: TeamShellProps) {
  const pathname = usePathname();
  const navItems = getTeamNavItems(profile.tier);
  if (creatorFeedAccess) navItems.splice(2, 0, { label: "Predictions", href: "/team/prediction-ledger" });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-8">
            <Link href="/team" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-secondary text-sm font-bold text-white shadow-lg shadow-accent/20">
                M2
              </span>
              <span className="text-lg font-semibold tracking-tight">M2MEC</span>
              <span className="hidden rounded-full border border-border px-2 py-0.5 text-xs text-muted sm:inline">
                Team
              </span>
            </Link>

            <nav className="hidden items-center gap-1 xl:flex">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/team"
                    ? pathname === "/team"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-surface-elevated text-foreground"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <p className="hidden whitespace-nowrap text-sm font-medium sm:block">
              {getProfileDisplayName(profile)}{" "}
              <span className="text-muted">({TIER_LABELS[profile.tier]})</span>
            </p>
            <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent sm:hidden">
              {TIER_LABELS[profile.tier]}
            </span>
            <TeamSignOut />
          </div>
        </div>
        <nav aria-label="Team navigation" className="flex gap-1 overflow-x-auto border-t border-border/60 px-6 py-2 xl:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={(item.href === "/team" ? pathname === item.href : pathname.startsWith(item.href)) ? "page" : undefined}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
                (item.href === "/team" ? pathname === item.href : pathname.startsWith(item.href))
                  ? "bg-surface-elevated text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
