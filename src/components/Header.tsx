import Link from "next/link";
import type { Profile } from "@/lib/auth/profile";
import { getProfileDisplayName } from "@/lib/auth/display-name";
import { hasMinimumTier } from "@/lib/tiers";

type NavLink = {
  label: string;
  href: string;
};

type HeaderProps = {
  navLinks: NavLink[];
  homeHref?: string;
  ctaLabel?: string;
  showLogin?: boolean;
  user?: Profile | null;
};

export function Header({
  navLinks,
  homeHref = "/",
  ctaLabel = "Get early access",
  showLogin = true,
  user = null,
}: HeaderProps) {
  const displayName = user ? getProfileDisplayName(user) : null;
  const showTeamLink = user ? hasMinimumTier(user.tier, "employee") : false;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href={homeHref} className="group flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-secondary text-sm font-bold text-white shadow-lg shadow-accent/20">
            M2
          </span>
          <span className="text-lg font-semibold tracking-tight">M2MEC</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              {showTeamLink && (
                <Link
                  href="/team"
                  className="hidden text-sm text-muted transition-colors hover:text-foreground sm:inline"
                >
                  Team
                </Link>
              )}
              <Link
                href="/account"
                className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-accent/40"
              >
                {displayName}
              </Link>
            </>
          ) : (
            <>
              {showLogin && (
                <Link
                  href="/login"
                  className="hidden text-sm text-muted transition-colors hover:text-foreground sm:inline"
                >
                  Log in
                </Link>
              )}
              <a
                href="#contact"
                className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                {ctaLabel}
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
