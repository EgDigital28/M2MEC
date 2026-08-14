import { Suspense } from "react";
import { InviteForm } from "@/components/InviteForm";
import { getCurrentProfile } from "@/lib/auth/profile";

export default async function TeamInvitePage() {
  const profile = await getCurrentProfile();
  const allowEmployeeTier = profile?.tier === "admin";

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          Team
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Invite someone
        </h1>
        <p className="mt-3 text-sm text-muted">
          Invites are sent from{" "}
          <span className="font-medium text-foreground">noreply@m2mec.com</span>. Recipients
          verify their email, set a password, and then can log in. Each email address can only
          be assigned one access tier.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface-elevated p-6 md:p-8">
        <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
          <InviteForm allowEmployeeTier={allowEmployeeTier} />
        </Suspense>
      </section>
    </div>
  );
}
