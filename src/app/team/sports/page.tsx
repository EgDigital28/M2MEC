import { redirect } from "next/navigation";
import { SportsAdmin } from "@/components/SportsAdmin";
import { getCurrentProfile } from "@/lib/auth/profile";

export default async function TeamSportsPage() {
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
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sports</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Manage the sport list used in the bet ledger. Only active sports appear
          in the dropdown when adding entries.
        </p>
      </section>

      <SportsAdmin />
    </div>
  );
}
