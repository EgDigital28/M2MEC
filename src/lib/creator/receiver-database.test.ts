import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { receiveCreatorEvent } from "./receiver.ts";
import { parsePartnerEvent, partnerLegLabel, partnerBodyDigest, signPartnerRequest, verifyPartnerRequest } from "./protocol.ts";

const migration = readFileSync(new URL("../../../supabase/migrations/20260912213839_add_creator_partner_feed.sql", import.meta.url), "utf8");
const owner = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const entity = "20000000-0000-4000-8000-000000000001";
function event(version = 1, eventId = `30000000-0000-4000-8000-${String(version).padStart(12, "0")}`) {
  return { schemaVersion: "ledger-creator-partner@1", source: "thepredictionledger", eventId, entityId: entity, entityType: "pick", entityVersion: version,
    creatorId: owner, destinationId: other, occurredAt: "2026-09-12T12:00:00.000Z",
    record: { id: entity, creator: { id: owner, displayName: "Test Creator", profileUrl: "https://www.thepredictionledger.com/handicappers/test" }, visibility: "public",
      headline: "Test pick", analysis: null, ledgerPickId: other, publicationStatus: "published", grade: "open", pickType: "single", units: 1,
      legs: [{ position: 0, eventId: other, eventName: "A vs B", selection: "A", marketType: "moneyline" }] } };
}
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to authenticated;
    create table profiles(id uuid primary key,tier text,suspended_at timestamptz);
    grant select on profiles to authenticated,service_role;
    insert into profiles values('${owner}','admin',null),('${other}','admin',null);`);
  await db.exec(migration);
  await db.exec(readFileSync(new URL("../../../supabase/migrations/20260914201913_accept_creator_partner_bets.sql", import.meta.url), "utf8"));
  return db;
}
async function accept(db: PGlite, value: ReturnType<typeof event>) {
  const raw = JSON.stringify(value);
  const parsed = parsePartnerEvent(raw);
  return (await db.query<{ receipt: { receiptId: string; outcome: string; duplicate: boolean } }>("select accept_creator_partner_event($1::jsonb,$2) receipt", [JSON.stringify(parsed), partnerBodyDigest(raw)])).rows[0]!.receipt;
}

test("signed Creator lifecycle remains idempotent and monotonic across retries and out-of-order delivery", async () => {
  const db = await setup();
  try {
    await db.exec("set role service_role");
    const first = event();
    const raw = JSON.stringify(first); const secret = "x".repeat(48);
    const signed = signPartnerRequest(raw, secret);
    assert.equal(verifyPartnerRequest(raw, secret, signed.timestamp, signed.signature), true);
    assert.equal(verifyPartnerRequest(raw + " ", secret, signed.timestamp, signed.signature), false);
    assert.equal(verifyPartnerRequest(raw, secret, signed.timestamp, signed.signature, Date.now() + 301000), false);
    assert.equal((await accept(db, first)).outcome, "applied");
    assert.equal((await accept(db, first)).duplicate, true);
    const grade = event(3); grade.record.grade = "won";
    assert.equal((await accept(db, grade)).outcome, "applied");
    assert.equal((await accept(db, event(2))).outcome, "ignored_stale");
    const retract = event(4); retract.record.publicationStatus = "retracted"; retract.record.grade = "void";
    await accept(db, retract);
    await accept(db, grade);
    assert.equal((await db.query<{ status: string }>("select record->>'publicationStatus' status from creator_partner_entities")).rows[0]!.status, "retracted");
    await assert.rejects(accept(db, { ...first, record: { ...first.record, headline: "Changed" } }), /payload conflict/);
    await assert.rejects(accept(db, { ...retract, eventId: "30000000-0000-4000-8000-000000000099", record: { ...retract.record, grade: "lost" } }), /version conflict/);
    await assert.rejects(accept(db, { ...event(5), creatorId: other, record: { ...first.record, creator: { ...first.record.creator, id: other } } }), /identity conflict/);
    assert.equal((await db.query<{ n: number }>("select count(*)::int n from creator_partner_receipts")).rows[0]!.n, 4);
  } finally { await db.close(); }
});

test("only the explicitly allowlisted active admin can read; browser roles cannot write or invoke receiver", async () => {
  const db = await setup();
  try {
    await db.exec("set role service_role"); await accept(db, event());
    await db.exec(`insert into creator_feed_viewers(user_id) values('${owner}'); reset role; set role authenticated; select set_config('test.uid','${other}',false);`);
    assert.equal((await db.query("select * from creator_partner_entities")).rows.length, 0);
    await db.exec(`select set_config('test.uid','${owner}',false)`);
    assert.equal((await db.query("select * from creator_partner_entities")).rows.length, 1);
    await assert.rejects(accept(db, event(2)), /permission denied/);
    await assert.rejects(db.exec("delete from creator_partner_entities"), /permission denied/);
    await assert.rejects(db.exec(`insert into creator_feed_viewers values('${other}',now())`), /permission denied/);
    await db.exec(`reset role; update profiles set suspended_at=now() where id='${owner}'; set role authenticated`);
    assert.equal((await db.query("select * from creator_partner_entities")).rows.length, 0);
    await db.exec("reset role; set role anon");
    await assert.rejects(db.exec("select * from creator_partner_entities"), /permission denied/);
  } finally { await db.close(); }
});


test("the HTTP receiver authenticates before persistence and returns the durable SQL receipt on retry", async () => {
  const db = await setup();
  try {
    await db.exec("set role service_role");
    let writes = 0;
    const persist = async (value: ReturnType<typeof parsePartnerEvent>, digest: string) => {
      writes++;
      try {
        const result = await db.query<{ receipt: unknown }>("select accept_creator_partner_event($1,$2) receipt", [JSON.stringify(value), digest]);
        return { data: result.rows[0]!.receipt, error: null };
      } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : "Persistence failed" } }; }
    };
    const raw = JSON.stringify(event()); const secret = "z".repeat(48); const signed = signPartnerRequest(raw, secret);
    const request = (signature = signed.signature, body = raw) => new Request("https://www.m2mec.com/api/integrations/ledger-creator", { method: "POST", headers: { "content-type": "application/json", "x-ledger-timestamp": signed.timestamp, "x-ledger-signature": signature }, body });
    assert.equal((await receiveCreatorEvent(request("0".repeat(64)), secret, persist)).status, 401);
    assert.equal(writes, 0);
    assert.equal((await receiveCreatorEvent(request(signed.signature, "x".repeat(256001)), secret, persist)).status, 413);
    assert.equal(writes, 0);
    const first = await receiveCreatorEvent(request(), secret, persist);
    assert.equal(first.status, 200); assert.equal((await first.json()).receiptId, event().eventId);
    const replay = await receiveCreatorEvent(request(), secret, persist);
    assert.equal((await replay.json()).duplicate, true);
    assert.equal((await db.query("select * from creator_partner_entities")).rows.length, 1);
  } finally { await db.close(); }
});


test("receiver retains complete multi-leg prop, total and MMA wager semantics for display", async () => {
  const db = await setup();
  try {
    await db.exec("set role service_role");
    const wager = event();
    const legs = [
      { position: 0, eventId: other, eventName: "A vs B", selection: "Player A", marketType: "player_prop", direction: "under", line: 5.5, marketStatType: "assists", selectedSportPlayerId: owner },
      { position: 1, eventId: other, eventName: "A vs B", selection: "Team A", marketType: "team_total", direction: "over", line: 20.5, period: "first_half", selectedFootballTeamId: owner },
      { position: 2, eventId: other, eventName: "C vs D", selection: "Fighter C", marketType: "mma_prop", mmaMarketCategory: "method", mmaSelectionScope: "fighter", mmaFinishMethod: "submission", mmaRounds: [1, 2], marketOutcome: "yes", selectedMmaFighterId: owner },
      { position: 3, eventId: other, eventName: "E vs F", selection: "Fight", marketType: "mma_prop", mmaTotalDirection: "under", mmaTotalRounds: 2.5 },
    ];
    wager.record.pickType = "parlay"; wager.record.legs = legs;
    await accept(db, wager);
    const stored = (await db.query<{ record: { legs: Record<string, unknown>[] } }>("select record from creator_partner_entities")).rows[0]!.record;
    assert.deepEqual(stored.legs, legs);
    assert.match(partnerLegLabel(stored.legs[0]!), /under 5.5 assists/);
    assert.match(partnerLegLabel(stored.legs[1]!), /over 20.5.*first half/);
    assert.match(partnerLegLabel(stored.legs[2]!), /by submission.*rounds 1, 2/);
    assert.match(partnerLegLabel(stored.legs[3]!), /under 2.5 rounds/);
    assert.throws(() => parsePartnerEvent(JSON.stringify({ ...wager, record: { ...wager.record, legs: [{ ...legs[0], marketStatType: "x".repeat(121) }, legs[1]] } })), /market semantics/);
  } finally { await db.close(); }
});


test("Bet receipts retain their type and private visibility through duplicate and later grade delivery", async () => {
  const db = await setup();
  try {
    await db.exec("set role service_role");
    const make = (version: number) => {
      const value = event(version);
      return {...value, entityType:"bet", record:{...value.record, visibility:"private", recordKind:"bet", creatorPickId:other,
        bet:{id:entity,sourceMethod:"manual_test",verificationStatus:"unverified",sportsbook:"Test book",currency:"USD",cashStake:"25.0000",bonusStake:"0.0000",potentialReturn:"50.0000",placedAt:value.occurredAt,recordedAt:value.occurredAt,providerStatus:"self_reported"}}};
    };
    const first = make(1);
    assert.equal((await accept(db, first)).outcome, "applied");
    assert.equal((await accept(db, first)).duplicate, true);
    const graded = make(3); graded.record.grade="won";
    assert.equal((await accept(db, graded)).outcome,"applied");
    assert.equal((await accept(db, make(2))).outcome,"ignored_stale");
    assert.throws(() => parsePartnerEvent(JSON.stringify({...first,entityType:"pick"})), /Invalid partner/);
    assert.throws(() => parsePartnerEvent(JSON.stringify({...first,record:{...first.record,bet:{...first.record.bet,notes:"private"}}})), /Invalid partner/);
    assert.throws(() => parsePartnerEvent(JSON.stringify({...first,record:{...first.record,bet:{...first.record.bet,cashStake:"NaN"}}})), /Invalid partner/);
  } finally { await db.close(); }
});
