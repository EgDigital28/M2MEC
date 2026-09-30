import { redirect } from "next/navigation";
import { DepositsAdmin } from "@/components/DepositsAdmin";
import { getCurrentProfile } from "@/lib/auth/profile";

export default async function TeamDepositsPage() {
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
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Deposits</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Every deposit is an entry here. Stake totals elsewhere in the app are
          the sum of these rows, so this is the only place deposits are edited.
        </p>
      </section>

      <DepositsAdmin />
    </div>
  );
}
