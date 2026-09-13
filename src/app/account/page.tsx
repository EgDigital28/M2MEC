import Link from "next/link";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { AuthShell } from "@/components/AuthShell";
import { TeamSignOut } from "@/components/TeamSignOut";
import { getProfileDisplayName } from "@/lib/auth/display-name";
import { getCurrentProfile } from "@/lib/auth/profile";
import { hasMinimumTier, TIER_LABELS } from "@/lib/tiers";

export default async function AccountPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login?next=/account");
  }

  const displayName = getProfileDisplayName(profile);
  const showTeamLink = hasMinimumTier(profile.tier, "employee");

  return (
    <AuthShell
      title="Account"
      description="Manage your M2MEC account settings."
    >
      <div className="space-y-8">
        <div className="rounded-xl border border-border bg-surface px-4 py-4 text-sm">
          <p className="font-medium text-foreground">{displayName}</p>
          <p className="mt-1 text-muted">{profile.email}</p>
          <p className="mt-2 text-xs uppercase tracking-widest text-accent">
            {TIER_LABELS[profile.tier]}
          </p>
        </div>

        {showTeamLink && (
          <Link
            href="/team"
            className="block rounded-xl border border-border px-4 py-3 text-sm transition-colors hover:border-accent/40"
          >
            Open team workspace →
          </Link>
        )}

        <div>
          <h2 className="text-sm font-medium">Password</h2>
          <p className="mt-1 text-sm text-muted">
            Update your password or use{" "}
            <Link href="/forgot-password" className="text-accent hover:underline">
              forgot password
            </Link>{" "}
            if you&apos;re signed out.
          </p>
          <div className="mt-4">
            <ChangePasswordForm />
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <TeamSignOut className="text-sm text-red-300 transition-colors hover:text-red-200" />
        </div>
      </div>
    </AuthShell>
  );
}
