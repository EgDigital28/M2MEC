import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const PARTNER_PROTOCOL = "ledger-creator-partner@1";
export const MAX_PARTNER_BODY_BYTES = 256_000;
export type PartnerEvent = {
  schemaVersion: typeof PARTNER_PROTOCOL;
  source: "thepredictionledger";
  eventId: string;
  entityType: "pick" | "package";
  entityId: string;
  entityVersion: number;
  occurredAt: string;
  creatorId: string;
  destinationId: string;
  record: Record<string, unknown>;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max;

export function parsePartnerEvent(raw: string): PartnerEvent {
  if (Buffer.byteLength(raw) > MAX_PARTNER_BODY_BYTES) throw new Error("Partner event is too large");
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.schemaVersion !== PARTNER_PROTOCOL || value.source !== "thepredictionledger"
    || ![value.eventId, value.entityId, value.creatorId, value.destinationId].every((id) => typeof id === "string" && uuid.test(id))
    || !["pick", "package"].includes(String(value.entityType))
    || !Number.isSafeInteger(value.entityVersion) || Number(value.entityVersion) < 1
    || !text(value.occurredAt, 40) || !Number.isFinite(Date.parse(String(value.occurredAt)))
    || !object(value.record)) throw new Error("Invalid partner event envelope");
  const record = value.record;
  if (!object(record.creator) || record.creator.id !== value.creatorId
    || !text(record.creator.displayName, 200) || !text(record.creator.profileUrl, 500)
    || !["public", "premium"].includes(String(record.visibility))
    || record.id !== value.entityId || !text(record.headline, 200)
    || (record.analysis !== null && record.analysis !== undefined && (typeof record.analysis !== "string" || record.analysis.length > 6000))) {
    throw new Error("Invalid partner entity identity or editorial content");
  }
  const profile = new URL(String(record.creator.profileUrl));
  if (profile.origin !== "https://www.thepredictionledger.com" || !profile.pathname.startsWith("/handicappers/")) throw new Error("Invalid Creator profile URL");
  if (value.entityType === "pick") {
    if (!uuid.test(String(record.ledgerPickId)) || !["published", "corrected", "retracted"].includes(String(record.publicationStatus))
      || !["open", "won", "lost", "push", "void"].includes(String(record.grade))
      || !["single", "parlay"].includes(String(record.pickType))
      || typeof record.units !== "number" || !Number.isFinite(record.units) || record.units <= 0
      || !Array.isArray(record.legs) || record.legs.length < 1 || record.legs.length > 12
      || (record.pickType === "single" && record.legs.length !== 1)
      || (record.pickType === "parlay" && record.legs.length < 2)) throw new Error("Invalid partner wager");
    for (const leg of record.legs) {
      if (!object(leg) || !uuid.test(String(leg.eventId)) || !text(leg.eventName, 500)
        || !text(leg.selection, 500) || !text(leg.marketType, 100)
        || !Number.isInteger(leg.position) || Number(leg.position) < 0) throw new Error("Invalid partner wager leg");
    }
    if (new Set(record.legs.map((leg) => (leg as Record<string, unknown>).position)).size !== record.legs.length) throw new Error("Duplicate leg positions");
  } else if (!uuid.test(String(record.productId)) || !["published", "withdrawn"].includes(String(record.status))
    || !Array.isArray(record.pickIds) || record.pickIds.length < 1 || record.pickIds.length > 50
    || !record.pickIds.every((id) => typeof id === "string" && uuid.test(id))
    || new Set(record.pickIds).size !== record.pickIds.length
    || !Number.isSafeInteger(record.priceCents) || Number(record.priceCents) < 0
    || !/^[A-Z]{3}$/.test(String(record.currency))) throw new Error("Invalid partner package");
  return value as PartnerEvent;
}

export function partnerBodyDigest(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function signPartnerRequest(raw: string, secret: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  if (secret.length < 32) throw new Error("Partner signing is not configured");
  return { timestamp, signature: createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex") };
}

export function verifyPartnerRequest(raw: string, secret: string, timestamp: string | null, signature: string | null, now = Date.now()) {
  if (secret.length < 32 || !timestamp || !/^\d{10}$/.test(timestamp) || !signature || !/^[a-f0-9]{64}$/.test(signature)
    || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = signPartnerRequest(raw, secret, timestamp).signature;
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
}
