// npm install --prefix /tmp/wa-test-tools @electric-sql/pglite
// WA_PGLITE=/tmp/wa-test-tools/node_modules/@electric-sql/pglite/dist/index.js node --test tests/whatsapp-db.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(process.env.WA_PGLITE || "@electric-sql/pglite");
test("database: permessi, deduplica, finestra, assegnazione, quota e stati fuori ordine", async () => {
  const db = new PGlite();
  const owner="00000000-0000-0000-0000-000000000001", a="00000000-0000-0000-0000-000000000002", b="00000000-0000-0000-0000-000000000003", c="00000000-0000-0000-0000-000000000004";
  try {
    await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls; create table association_members(user_id uuid primary key references auth.users(id), active boolean, activated_at timestamptz); grant select on association_members to service_role;");
    for(const id of [owner,a,b,c]) {
      await db.query("insert into auth.users values($1)",[id]);
      await db.query("insert into association_members values($1,true,now())",[id]);
    }
    await db.exec(await readFile(new URL("../supabase/migrations/20261025055615_whatsapp_inbox.sql",import.meta.url),"utf8"));
    for(const role of ["anon","authenticated"]) {
      for(const table of ["wa_operators","wa_conversations","wa_messages"]) {
        const {rows}=await db.query("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') as allowed",[role,table]);
        assert.equal(rows[0].allowed,false);
      }
      await db.exec("set role "+role);
      await assert.rejects(db.query("select * from wa_messages"), /permission denied/);
      await assert.rejects(db.query("select wa_receive('{}')"), /permission denied/);
      await db.exec("reset role");
    }
    const rpc=async(sql,args=[]) => (await db.query(sql,args)).rows[0]?.result;
    await db.exec("set role service_role");
    for(const id of [a,b]) assert.equal((await rpc("select wa_set_operator($1,true,$2) result",[id,owner])).ok,true);
    assert.match((await rpc("select wa_set_operator($1,true,$2) result",[c,owner])).error,/due operatori/);
    const event={meta_id:"in-1",wa_id:"393331234567",name:"Famiglia esempio",sent_at:new Date(Date.now()-60000).toISOString(),type:"text",text:"Ciao"};
    await db.query("select wa_receive($1)",[JSON.stringify(event)]);
    await db.query("select wa_receive($1)",[JSON.stringify(event)]);
    let row=(await db.query("select * from wa_conversations")).rows[0];
    assert.equal(row.unread_count,1);
    assert.equal((await db.query("select * from wa_messages")).rows.length,1);
    assert.equal((await rpc("select wa_manage($1,$2,'assigned',$3) result",[row.id,row.version,a])).ok,true);
    assert.match((await rpc("select wa_manage($1,$2,'assigned',$3) result",[row.id,row.version,b])).error,/aggiornata/);
    const send=async(id,actor=a,cap=950) => rpc("select wa_reserve($1,$2,$3,false,'Risposta',$4) result",[id,row.id,actor,cap]);
    const request="10000000-0000-0000-0000-000000000001";
    assert.equal((await send(request)).ok,true);
    assert.match((await send(request)).error,/già registrata/);
    assert.match((await send("10000000-0000-0000-0000-000000000002")).error,/esito da verificare/);
    await db.query("select wa_delivery('out-1',$1,'read',null)",[request]);
    await db.query("select wa_delivery('out-1',$1,'sent',null)",[request]);
    await db.query("select wa_delivery(null,$1,'unknown','network')",[request]);
    assert.equal((await db.query("select state from wa_messages where id=$1",[request])).rows[0].state,"read");
    assert.match((await send("10000000-0000-0000-0000-000000000003",a,1)).error,/Limite mensile/);
    assert.match((await send("10000000-0000-0000-0000-000000000003",b)).error,/Prendi in gestione/);
    const request2="10000000-0000-0000-0000-000000000004";
    assert.equal((await send(request2)).ok,true);
    await db.query("select wa_delivery('out-2',$1,'accepted',null)",[request2]);
    await db.query("select wa_delivery('out-2',$1,'failed','131047')",[request2]);
    assert.equal((await db.query("select state from wa_messages where id=$1",[request2])).rows[0].state,"failed");
    assert.equal((await rpc("select wa_usage() result")).reserved,1);
    await db.query("update wa_conversations set last_inbound_at=now()-interval '24 hours' where id=$1",[row.id]);
    assert.match((await send("10000000-0000-0000-0000-000000000005")).error,/Finestra/);
    await db.query("update wa_conversations set status='closed' where id=$1",[row.id]);
    await db.query("select wa_receive($1)",[JSON.stringify({...event,meta_id:"in-2",text:"Nuovo messaggio",sent_at:new Date().toISOString()})]);
    row=(await db.query("select * from wa_conversations")).rows[0];
    assert.equal(row.status,"open"); assert.equal(row.assigned_to,null); assert.equal(row.unread_count,2);
    await rpc("select wa_manage($1,$2,'read',$3) result",[row.id,row.version,a]);
    assert.equal((await db.query("select unread_count from wa_conversations")).rows[0].unread_count,0);
    await rpc("select wa_set_operator($1,false,$2) result",[a,owner]);
    assert.match((await send("10000000-0000-0000-0000-000000000006")).error,/revocato/);
    await db.exec("reset role");
    const security=await db.query("select relname,relrowsecurity from pg_class where relname in ('wa_messages','wa_conversations','wa_operators')");
    assert.equal(security.rows.length,3); assert.ok(security.rows.every(r=>r.relrowsecurity));
  } finally { await db.close(); }
});
