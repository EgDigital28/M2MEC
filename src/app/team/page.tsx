import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/profile";
import { hasMinimumTier, TIER_DESCRIPTIONS, TIER_LABELS } from "@/lib/tiers";

const platformModules: {
  title: string;
  description: string;
  status: string;
  href?: string;
}[] = [
  {
    title: "Data Services",
    description: "Odds, line movement, and normalized sports data pipelines.",
    status: "Coming soon",
  },
  {
    title: "Predictive Analytics",
    description: "ML breakdowns, edge detection, and confidence scoring.",
    status: "Coming soon",
  },
  {
    title: "Sportsbook Hub",
    description: "Consolidated positions and exposure across books.",
    status: "Live",
    href: "/team/bets",
  },
  {
    title: "AI Assistant",
    description: "Plain-language queries grounded in your data.",
    status: "Coming soon",
  },
];

export default async function TeamPage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.tier === "admin";

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          Team workspace
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Welcome back
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Signed in as{" "}
          <span className="font-medium text-foreground">{profile?.email}</span>{" "}
          with{" "}
          <span className="font-medium text-foreground">
            {profile ? TIER_LABELS[profile.tier] : "Team"}
          </span>{" "}
          access — {profile ? TIER_DESCRIPTIONS[profile.tier] : "internal tools"}.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/team/invite"
          className="group rounded-2xl border border-border bg-surface-elevated p-6 transition-colors hover:border-accent/40"
        >
          <p className="text-sm font-medium text-accent">Quick action</p>
          <h2 className="mt-2 text-xl font-semibold">Invite someone</h2>
          <p className="mt-2 text-sm text-muted">
            Send an account invite with the right access tier.
          </p>
          <p className="mt-4 text-sm text-accent group-hover:underline">
            Open invites →
          </p>
        </Link>

        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm font-medium text-muted">Your access</p>
          <h2 className="mt-2 text-xl font-semibold">
            {profile ? TIER_LABELS[profile.tier] : "Team"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {profile ? TIER_DESCRIPTIONS[profile.tier] : "Internal team tools"}
          </p>
        </div>
      </section>

      {isAdmin && (
        <section className="rounded-2xl border border-accent/20 bg-accent/5 p-6 md:p-8">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            Admin
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Admin controls</h2>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Manage sports, users, waitlist, invites, and team invites from the team workspace.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/team/invite"
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Send invite
            </Link>
            <Link
              href="/team/users"
              className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-accent/40"
            >
              Manage users
            </Link>
            <Link
              href="/team/sports"
              className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-accent/40"
            >
              Manage sports
            </Link>
            <Link
              href="/team/waitlist"
              className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-accent/40"
            >
              Waitlist
            </Link>
            <Link
              href="/team/invite"
              className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-accent/40"
            >
              Invite activity
            </Link>
            <Link
              href="/team/expenses"
              className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-accent/40"
            >
              Expenses
            </Link>
            <Link
              href="/"
              className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-accent/40"
            >
              View public site
            </Link>
          </div>
        </section>
      )}

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Platform</h2>
            <p className="mt-2 text-sm text-muted">
              Modules we&apos;re building out for the team first.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {platformModules.map((module) => {
            const content = (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">{module.title}</h3>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      module.status === "Live"
                        ? "border-emerald-500/30 text-emerald-300"
                        : "border-border text-muted"
                    }`}
                  >
                    {module.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted">{module.description}</p>
                {"href" in module && module.href ? (
                  <p className="mt-4 text-sm text-accent">Open →</p>
                ) : null}
              </>
            );

            if (module.href) {
              return (
                <Link
                  key={module.title}
                  href={module.href}
                  className="rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-accent/40"
                >
                  {content}
                </Link>
              );
            }

            return (
              <div
                key={module.title}
                className="rounded-2xl border border-border bg-surface p-6"
              >
                {content}
              </div>
            );
          })}
        </div>
      </section>

      {profile && !hasMinimumTier(profile.tier, "admin") && (
        <p className="text-sm text-muted">
          Need admin access? Ask an admin to update your tier in Supabase.
        </p>
      )}
    </div>
  );
}
