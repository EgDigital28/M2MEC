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
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Bet ledger</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Track positions by event. Enter date, sport, event, line, and risk —
          To Win and P/L are calculated from your spreadsheet formulas.
        </p>
      </section>

      <BetLedger isAdmin={isAdmin} />
    </div>
  );
}
