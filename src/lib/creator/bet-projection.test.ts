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
 await db.exec(sql('20260919183700_normalize_ledger_ufc_card_mapping.sql'));
 await db.exec('grant select,insert,update,delete on bet_entries to authenticated,service_role');
 const headlines=[
  [{selection:'Ryan Gandra',marketType:'fighter_method',mmaFinishMethod:'ko_tko',mmaRounds:null,period:'full_event'},'Ryan Gandra by KO/TKO'],
  [{selection:'Denver Broncos',marketType:'spread',line:3.5,period:'full_event'},'Denver Broncos +3.5'],
  [{selection:'under',eventName:'Phoenix Mercury vs Dallas Wings',marketType:'game_total',direction:'under',line:176.5,period:'full_event'},'Phoenix Mercury vs Dallas Wings under 176.5'],
  [{selection:'San Diego State Aztecs',marketType:'moneyline',period:'full_event'},'San Diego State Aztecs ML'],
  [{selection:'Jannik Sinner',marketType:'game_spread',line:-2.5,period:'full_event'},'Jannik Sinner -2.5'],
 ] as const;
 for(const [leg,expected] of headlines)assert.equal((await db.query<{label:string}>('select ledger_bet_headline($1) label',[leg])).rows[0].label,expected);
 const record={id:id(3),creator:{id:id(1)},visibility:'private',recordKind:'bet',grade:'open',publicationStatus:'published',oddsAmerican:-110,bet:{id:id(3),currency:'USD',cashStake:'110',bonusStake:'0',placedAt:'2026-09-19T12:00:00Z',settledNet:null as string|null},legs:[{sport:'wnba',league:'WNBA',eventName:'Phoenix Mercury vs Dallas Wings',selection:'under',marketType:'game_total',line:176.5 as number|null,period:'full_event',mmaFinishMethod:null as string|null}]};
 const accept=async(version:number)=>db.query('select accept_creator_partner_event($1,$2)',[{schemaVersion:'ledger-creator-partner@1',source:'thepredictionledger',eventId:id(10+version),entityId:record.id,creatorId:id(1),entityType:'bet',entityVersion:version,occurredAt:'2026-09-19T12:00:00Z',record},version.toString(16).padStart(64,'0')]);
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

 // The real feed uses a UFC card title as league, not the abbreviation.
 await db.exec(`reset role;insert into sports values('${id(4)}','UFC','Ultimate Fighting Championship',true);set role service_role`);
 await db.query('insert into ledger_sport_mappings values($1,$2,$3)',['mma','ufc',id(4)]);
 record.id=id(5);record.bet.id=id(5);record.grade='open';record.bet.cashStake='25000';record.bet.settledNet=null;record.oddsAmerican=-190;
 record.legs=[{sport:'mma',league:'UFC 331: Van vs. Pantoja 2',eventName:'Ozzy Diaz vs Ryan Gandra',selection:'Ryan Gandra',marketType:'fighter_method',line:null,period:'full_event',mmaFinishMethod:'ko_tko'}];
 await accept(4);
 let mma=(await db.query<{sport_id:string;event_name:string;status:string;ledger_to_win:number;ledger_profit_loss:number}>("select * from bet_entries where ledger_entity_id=$1",[id(5)])).rows[0];
 assert.equal(mma.sport_id,id(4));assert.equal(mma.event_name,'Ryan Gandra by KO/TKO');assert.equal(mma.status,'Open');assert.equal(Number(mma.ledger_to_win).toFixed(2),'13157.89');
 await db.query('select project_ledger_bet($1)',[id(5)]);
 assert.equal((await db.query('select * from bet_entries where ledger_entity_id=$1',[id(5)])).rows.length,1);
 record.grade='won';await accept(5);
 mma=(await db.query<typeof mma>("select * from bet_entries where ledger_entity_id=$1",[id(5)])).rows[0];assert.equal(mma.status,'Win');assert.equal(Number(mma.ledger_profit_loss).toFixed(2),'13157.89');
 record.grade='lost';await accept(8);
 assert.equal(Number((await db.query<{ledger_profit_loss:number}>('select ledger_profit_loss from bet_entries where ledger_entity_id=$1',[id(5)])).rows[0].ledger_profit_loss),-25000);
 record.grade='void';await accept(9);
 const voided=(await db.query<{status:string;ledger_profit_loss:number}>('select status,ledger_profit_loss from bet_entries where ledger_entity_id=$1',[id(5)])).rows[0];assert.equal(voided.status,'Void');assert.equal(Number(voided.ledger_profit_loss),0);
 record.grade='won';await accept(10);await accept(10);
 record.grade='open';await accept(4);
 const corrected=(await db.query<{status:string;ledger_profit_loss:number;ledger_version:number}>('select status,ledger_profit_loss,ledger_version from bet_entries where ledger_entity_id=$1',[id(5)])).rows;
 assert.equal(corrected.length,1);assert.equal(corrected[0].status,'Win');assert.equal(Number(corrected[0].ledger_profit_loss).toFixed(2),'13157.89');assert.equal(Number(corrected[0].ledger_version),10);
 // Exact operator mappings take precedence over the UFC fallback.
 await db.query('insert into ledger_sport_mappings values($1,$2,$3)',['mma','ufc 331: van vs. pantoja 2',id(2)]);
 record.id=id(7);record.bet.id=id(7);await accept(7);
 assert.equal((await db.query<{sport_id:string}>('select sport_id from bet_entries where ledger_entity_id=$1',[id(7)])).rows[0].sport_id,id(2));
 // Unknown MMA promotions must not silently become UFC.
 record.id=id(6);record.bet.id=id(6);record.legs[0].league='PFL 2026';await accept(6);
 assert.equal((await db.query('select * from bet_entries where ledger_entity_id=$1',[id(6)])).rows.length,0);
 assert.equal((await db.query<{error_code:string}>('select error_code from ledger_bet_projection_errors where entity_id=$1',[id(6)])).rows[0].error_code,'sport_mapping_required');
 await db.exec('set role authenticated');await assert.rejects(db.query("update bet_entries set status='Win'"),/read-only/);await assert.rejects(db.query('delete from bet_entries'),/read-only/);
 }finally{await db.close();}
});
