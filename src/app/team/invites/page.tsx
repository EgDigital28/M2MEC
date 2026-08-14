import { redirect } from "next/navigation";
import { InvitesAdmin } from "@/components/InvitesAdmin";
import { getCurrentProfile } from "@/lib/auth/profile";

export default async function TeamInvitesPage() {
  const profile = await getCurrentProfile();

  if (profile?.tier !== "admin") {
    redirect("/team");
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          Admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Invite activity</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Track sent invites, pending registrations, and resend links when someone needs a fresh
          invite email.
        </p>
      </section>

      <InvitesAdmin />
    </div>
  );
}
