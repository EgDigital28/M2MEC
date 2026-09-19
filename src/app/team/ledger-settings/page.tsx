import Link from "next/link";
import {redirect} from "next/navigation";
import {requireMinimumTier} from "@/lib/auth/profile";
import {createAdminClient} from "@/lib/supabase/admin";
import {saveMapping,replayBet} from "./actions";
export default async function LedgerSettings(){
 const auth=await requireMinimumTier("admin");if("error" in auth)redirect("/team");
 const db=createAdminClient();const [sports,mappings,errors]=await Promise.all([
 db.from("sports").select("id,abbreviation,full_name").eq("is_active",true).order("abbreviation").limit(500),
 db.from("ledger_sport_mappings").select("sport,league,sport_id").order("sport").limit(500),
 db.from("ledger_bet_projection_errors").select("entity_id,entity_version,error_code,updated_at").order("updated_at",{ascending:false}).limit(100),
 ]);
 if(sports.error||mappings.error||errors.error)throw new Error("Ledger mapping settings unavailable");
 return <main className="space-y-6"><Link href="/team/bets">← Bet ledger</Link><h1 className="text-3xl">Ledger import settings</h1><p>Map Ledger sport and league values to an M2MEC sport before importing. Values are case-insensitive. Multi-sport parlays use sport “multi_sport” and league “parlay”. This USD ledger holds other currencies for review.</p><form action={saveMapping} className="flex flex-wrap gap-3"><label>Ledger sport<input name="sport" required maxLength={80} className="block border p-2" placeholder="basketball"/></label><label>Ledger league<input name="league" maxLength={120} className="block border p-2" placeholder="WNBA"/></label><label>M2MEC sport<select name="sportId" required className="block border p-2">{sports.data.map(s=><option key={s.id} value={s.id}>{s.abbreviation} · {s.full_name}</option>)}</select></label><button className="border px-4">Save mapping</button></form><ul>{mappings.data.map(m=><li key={m.sport+":"+m.league}>{m.sport} / {m.league || "(empty)"} → {sports.data.find(s=>s.id===m.sport_id)?.abbreviation??m.sport_id}</li>)}</ul><h2 className="text-xl">Imports needing attention (latest 100)</h2>{errors.data.map(e=><form action={replayBet} key={e.entity_id} className="flex justify-between border p-3"><span>{e.entity_id} · {e.error_code.replaceAll("_"," ")} · version {e.entity_version}</span><input type="hidden" name="entityId" value={e.entity_id}/><button>Retry latest Ledger version</button></form>)}{!errors.data.length&&<p>No pending import errors.</p>}</main>;
}
