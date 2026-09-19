import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=(file:string)=>readFileSync(new URL('../../../supabase/migrations/'+file,import.meta.url),'utf8');
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('Ledger Bet projection maps before insertion, applies grades once, and rejects user modification',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select '${id(1)}'::uuid$$;
 create table profiles(id uuid primary key,tier text,suspended_at timestamptz);insert into profiles values('${id(1)}','admin',null);
 create table sports(id uuid primary key,abbreviation text,full_name text,is_active boolean);insert into sports values('${id(2)}','WNBA','WNBA',true);
 grant usage on schema public,auth to authenticated,service_role;grant select on profiles,sports to authenticated,service_role;`);
 await db.exec(sql('003_bet_entries.sql'));await db.exec(sql('20260912213839_add_creator_partner_feed.sql'));await db.exec(sql('20260914201913_accept_creator_partner_bets.sql'));await db.exec(sql('20260919133744_ledger_bet_projection.sql'));
 await db.exec('grant select,insert,update,delete on bet_entries to authenticated,service_role');
 const record={id:id(3),creator:{id:id(1)},visibility:'private',recordKind:'bet',grade:'open',publicationStatus:'published',oddsAmerican:-110,bet:{id:id(3),currency:'USD',cashStake:'110',bonusStake:'0',placedAt:'2026-09-19T12:00:00Z',settledNet:null as string|null},legs:[{sport:'wnba',league:'WNBA',eventName:'Phoenix Mercury vs Dallas Wings',selection:'under',marketType:'game_total',line:176.5,period:'full_event'}]};
 const accept=async(version:number)=>db.query('select accept_creator_partner_event($1,$2)',[{schemaVersion:'ledger-creator-partner@1',source:'thepredictionledger',eventId:id(10+version),entityId:id(3),creatorId:id(1),entityType:'bet',entityVersion:version,occurredAt:'2026-09-19T12:00:00Z',record},String(version).repeat(64)]);
 await db.exec('set role service_role');
 assert.equal((await db.query<{ok:boolean}>('select claim_ledger_consumer($1) ok',[id(50)])).rows[0].ok,true);
 assert.equal((await db.query<{ok:boolean}>('select claim_ledger_consumer($1) ok',[id(51)])).rows[0].ok,false);
 await db.query('select release_ledger_consumer($1)',[id(51)]);
 assert.equal((await db.query<{ok:boolean}>('select claim_ledger_consumer($1) ok',[id(51)])).rows[0].ok,false);
 await db.query('select release_ledger_consumer($1)',[id(50)]);
 await accept(1);
 assert.equal((await db.query('select * from bet_entries')).rows.length,0);
 assert.equal((await db.query<{error_code:string}>('select error_code from ledger_bet_projection_errors')).rows[0].error_code,'sport_mapping_required');
 await db.query('insert into ledger_sport_mappings values($1,$2,$3)',['wnba','wnba',id(2)]);
 assert.equal((await db.query<{ok:boolean}>('select project_ledger_bet($1) ok',[id(3)])).rows[0].ok,true);
 record.grade='won';record.bet.settledNet='100';await accept(2);await accept(2);
 const rows=(await db.query<{status:string;ledger_profit_loss:number;ledger_entity_id:string;line:number;risk:number}>('select * from bet_entries')).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].status,'Win');assert.equal(Number(rows[0].ledger_profit_loss),100);
 record.grade='lost';record.bet.settledNet='-110';await accept(3);
 assert.equal((await db.query<{status:string}>('select status from bet_entries')).rows[0].status,'Loss');
 await db.exec('set role authenticated');await assert.rejects(db.query("update bet_entries set status='Win'"),/read-only/);await assert.rejects(db.query('delete from bet_entries'),/read-only/);
 }finally{await db.close();}
});
