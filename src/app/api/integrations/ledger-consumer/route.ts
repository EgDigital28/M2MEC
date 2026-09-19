import { timingSafeEqual } from "node:crypto";
import { consumeLedgerFeed } from "@/lib/creator/consumer";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 const supplied=request.headers.get("authorization")??"";
 const expected=`Bearer ${secret}`;
 if(!secret||Buffer.byteLength(supplied)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return Response.json({error:"Unauthorized"},{status:401});
 const db=createAdminClient();
 const owner=crypto.randomUUID();
 const lease=await db.rpc("claim_ledger_consumer",{p_owner:owner});
 if(lease.error)return Response.json({error:"Importer lease unavailable"},{status:503});
 if(!lease.data)return Response.json({skipped:"Importer already running"});
 try {const result=await consumeLedgerFeed(process.env.LEDGER_CONSUMER_KEY??"",async(event,digest)=>{
 const saved=await db.rpc("accept_creator_partner_event",{p_event:event,p_digest:digest});if(saved.error)throw new Error("Could not persist Ledger event");
 });return Response.json(result);}
 catch(error){console.error("ledger.consumer.failed",error instanceof Error?error.message:"unknown");return Response.json({error:"Ledger import failed; retry retains receipts."},{status:503});}
 finally {await db.rpc("release_ledger_consumer",{p_owner:owner});}
}
