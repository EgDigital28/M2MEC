import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { InviteForm } from "@/components/InviteForm";
import { requireMinimumTier } from "@/lib/auth/profile";

export default async function TeamInvitePage() {
  const result = await requireMinimumTier("employee");

  if ("error" in result) {
    if (result.error === "unauthenticated") {
      redirect("/login?next=/team/invite");
    }

    redirect("/");
  }

  const allowEmployeeTier = result.profile.tier === "admin";

  return (
    <AuthShell
      title="Invite someone"
      description={`Send an account invite as ${result.profile.email}. They'll verify their email and set a password.`}
    >
      <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
        <InviteForm allowEmployeeTier={allowEmployeeTier} />
      </Suspense>
    </AuthShell>
  );
}
