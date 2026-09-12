import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { receiveCreatorEvent } from "@/lib/creator/receiver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const secret = process.env.LEDGER_CREATOR_SIGNING_SECRET ?? "";
  const db = tryCreateAdminClient();
  if (secret.length < 32 || !db) return Response.json({ error: "Creator receiver is not configured" }, { status: 503 });
  return receiveCreatorEvent(request, secret, async (event, digest) => {
    const { data, error } = await db.rpc("accept_creator_partner_event", { p_event: event, p_digest: digest });
    return { data, error };
  });
}
