import Link from "next/link";
import { BetLedger } from "@/components/BetLedger";
import { getCurrentProfile } from "@/lib/auth/profile";

export default async function TeamBetsPage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.tier === "admin";

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          Sportsbook Hub
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Ledger</h1>
      </section>

      {isAdmin && <Link href="/team/ledger-settings" className="underline">Ledger import settings and errors</Link>}
      <BetLedger isAdmin={isAdmin} />
    </div>
  );
}
