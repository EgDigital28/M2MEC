import { Suspense } from "react";
import { InvitesAdmin } from "@/components/InvitesAdmin";
import { InviteForm } from "@/components/InviteForm";
import { getCurrentProfile } from "@/lib/auth/profile";

export default async function TeamInvitePage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.tier === "admin";
  const allowEmployeeTier = isAdmin;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          Team
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Invites</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Invites are sent from{" "}
          <span className="font-medium text-foreground">noreply@m2mec.com</span>. Recipients
          verify their email, set a password, and then can log in. Each email address can only
          be assigned one access tier.
        </p>
      </section>

      <section className="mx-auto max-w-lg rounded-2xl border border-border bg-surface-elevated p-6 md:p-8">
        <h2 className="text-lg font-semibold">Invite someone</h2>
        <div className="mt-4">
          <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
            <InviteForm allowEmployeeTier={allowEmployeeTier} />
          </Suspense>
        </div>
      </section>

      {isAdmin ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Invite activity</h2>
            <p className="mt-1 text-sm text-muted">
              Track sent invites, pending registrations, and resend links when someone needs a
              fresh invite email.
            </p>
          </div>
          <InvitesAdmin />
        </section>
      ) : null}
    </div>
  );
}
