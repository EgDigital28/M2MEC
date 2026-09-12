import { MAX_PARTNER_BODY_BYTES, parsePartnerEvent, partnerBodyDigest, verifyPartnerRequest, type PartnerEvent } from "./protocol.ts";

type Persist = (event: PartnerEvent, digest: string) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
export async function receiveCreatorEvent(request: Request, secret: string, persist: Persist) {
  if (secret.length < 32) return Response.json({ error: "Creator receiver is not configured" }, { status: 503 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "JSON required" }, { status: 415 });
  if (Number(request.headers.get("content-length")) > MAX_PARTNER_BODY_BYTES) return Response.json({ error: "Event too large" }, { status: 413 });
  // Limit streamed requests too; Content-Length alone is not authoritative.
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Event required" }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_PARTNER_BODY_BYTES) {
      await reader.cancel();
      return Response.json({ error: "Event too large" }, { status: 413 });
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!verifyPartnerRequest(raw, secret, request.headers.get("x-ledger-timestamp"), request.headers.get("x-ledger-signature"))) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }
  let event;
  try { event = parsePartnerEvent(raw); }
  catch { return Response.json({ error: "Invalid Creator event" }, { status: 422 }); }
  const { data, error } = await persist(event, partnerBodyDigest(raw));
  if (error) {
    const conflict = error.message.includes("conflict");
    console.error("creator.receiver.failed", { eventId: event.eventId, code: error.code });
    return Response.json({ error: conflict ? "Event conflict" : "Could not persist event" }, { status: conflict ? 409 : 503 });
  }
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
