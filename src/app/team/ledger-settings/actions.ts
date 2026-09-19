"use server";
import {requireMinimumTier} from "@/lib/auth/profile";
import {createAdminClient} from "@/lib/supabase/admin";
import {revalidatePath} from "next/cache";
export async function saveMapping(form:FormData){
 const auth=await requireMinimumTier("admin");if("error" in auth)throw new Error("Admin required");
 const sport=String(form.get("sport")??"").trim().toLowerCase(),league=String(form.get("league")??"").trim().toLowerCase();
 if(!sport||sport.length>80||league.length>120)throw new Error("Invalid mapping");
 const db=createAdminClient();const {error}=await db.from("ledger_sport_mappings").upsert({sport,league,sport_id:String(form.get("sportId"))});
 if(error)throw new Error("Mapping could not be saved");revalidatePath("/team/ledger-settings");
}
export async function replayBet(form:FormData){
 const auth=await requireMinimumTier("admin");if("error" in auth)throw new Error("Admin required");
 const {error}=await createAdminClient().rpc("project_ledger_bet",{p_entity:String(form.get("entityId"))});
 if(error)throw new Error("Retry failed");revalidatePath("/team/ledger-settings");revalidatePath("/team/bets");
}
