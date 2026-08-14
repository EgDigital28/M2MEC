import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { getDefaultDestination } from "@/lib/auth/destination";
import { getProfileDisplayName } from "@/lib/auth/display-name";
import { getCurrentProfile } from "@/lib/auth/profile";

export default async function InvestorPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login?next=/investor");
  }

  if (profile.tier !== "investor") {
    redirect(getDefaultDestination(profile.tier));
  }

  const displayName = getProfileDisplayName(profile);

  return (
    <>
      <Header navLinks={[]} showLogin={false} user={profile} homeHref="/investor" />
      <main className="min-h-screen px-6 pt-28 pb-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
            Investor access
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Welcome, {displayName}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            Your M2MEC investor portal is being prepared. This is your home base after sign-in —
            reports, updates, and platform access will appear here as they become available.
          </p>

          <div className="mt-10 rounded-2xl border border-border bg-surface px-6 py-8">
            <p className="text-sm font-medium text-foreground">Coming soon</p>
            <p className="mt-2 text-sm text-muted">
              We&apos;re building the investor experience. Check back for performance summaries,
              product updates, and curated platform views.
            </p>
          </div>

          <p className="mt-8 text-sm text-muted">
            Need to update your password?{" "}
            <Link href="/account" className="text-accent hover:underline">
              Account settings
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
