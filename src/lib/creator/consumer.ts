import {parsePartnerEvent,partnerBodyDigest,type PartnerEvent} from "./protocol.ts";
export async function consumeLedgerFeed(key:string,persist:(event:PartnerEvent,digest:string)=>Promise<void>,fetcher:typeof fetch=fetch) {
 if(!/^lc_[a-f0-9]{64}$/.test(key))throw new Error("Consumer key is not configured");
 const url="https://www.thepredictionledger.com/api/consumers/v1/events";
 const headers={Authorization:`Bearer ${key}`,"Content-Type":"application/json"};
 const response=await fetcher(url,{headers,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(`Ledger feed returned ${response.status}`);
 const body=await response.json();
 if(body.schemaVersion!=="ledger-consumer-feed@1"||!Array.isArray(body.events)||body.events.length>100)throw new Error("Invalid feed response");
 const acknowledged:string[]=[];
 const deadline=Date.now()+25000;
 for(const value of body.events){
 if(acknowledged.length && Date.now()>=deadline)break;
 const raw=JSON.stringify(value);const event=parsePartnerEvent(raw);
 await persist(event,partnerBodyDigest(raw));acknowledged.push(event.eventId);
 }
 if(acknowledged.length){const ack=await fetcher(url,{method:"POST",headers,body:JSON.stringify({acknowledge:acknowledged}),redirect:"error",signal:AbortSignal.timeout(15000)});if(!ack.ok)throw new Error("Ledger acknowledgement failed; receipt replay is safe");}
 return {received:acknowledged.length};
}
