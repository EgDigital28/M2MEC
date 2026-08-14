import { redirect } from "next/navigation";
import { UsersAdmin } from "@/components/UsersAdmin";
import { getCurrentProfile } from "@/lib/auth/profile";

export default async function TeamUsersPage() {
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
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Users</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Manage team accounts. Suspended users cannot sign in or be invited again
          until you unsuspend them.
        </p>
      </section>

      <UsersAdmin currentUserId={profile.id} />
    </div>
  );
}
