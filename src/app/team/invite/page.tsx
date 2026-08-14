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
          Send an account invite as{" "}
          <span className="font-medium text-foreground">{profile?.email}</span>.
          They&apos;ll verify their email, set a password, and then can log in.
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
