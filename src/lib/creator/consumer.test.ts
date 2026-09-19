import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeLedgerFeed} from './consumer.ts';
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

test('consumer acknowledges only durable receipts and safely retries failed acknowledgements',async()=>{
 const envelope=event();const calls:string[]=[];
 const fetcher:typeof fetch=async(_url,options)=>{calls.push(options?.method??'GET');return Response.json(options?.method==='POST'?{}:{schemaVersion:'ledger-consumer-feed@1',events:[envelope]});};
 await assert.rejects(consumeLedgerFeed('lc_'+'a'.repeat(64),async()=>{throw new Error('Persistence failed');},fetcher),/Persistence failed/);
 assert.deepEqual(calls,['GET']);calls.length=0;
 const persisted:string[]=[];await consumeLedgerFeed('lc_'+'a'.repeat(64),async(value)=>{persisted.push(value.eventId);},fetcher);
 assert.deepEqual(calls,['GET','POST']);assert.deepEqual(persisted,[envelope.eventId]);
});
