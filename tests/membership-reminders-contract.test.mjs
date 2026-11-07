import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const cron=readFileSync("app/api/cron/quote-associative/route.ts","utf8");
const api=readFileSync("app/api/associazione/libri-sociali/promemoria/route.ts","utf8");
const sql=readFileSync("supabase/migrations/20261107173000_fee_reminders.sql","utf8");
const cfg=JSON.parse(readFileSync("vercel.json","utf8"));
test("schedulazione giornaliera e autenticazione cron fail closed",()=>{
 assert.deepEqual(cfg.crons,[{path:"/api/cron/quote-associative",schedule:"0 9 * * *"}]);
 assert.match(cron,/process\.env\.CRON_SECRET/);
 assert.match(cron,/if\(!secret\|\|request\.headers\.get\("authorization"\)!=="Bearer "\+secret\)/);
 assert.match(cron,/datePlus\(romeDate\(\),7\)/);
});
test("esclusi soci che hanno già pagato, cessati e senza email",()=>{
 assert.match(cron,/association_membership_fees\?fee_year/);
 assert.match(cron,/!paid\.has\(p\.id\)/);
 assert.match(cron,/!p\.ended_on\|\|p\.ended_on>=dueOn/);
 assert.match(cron,/if\(!email\|\|/);
});
test("idempotenza e invio individuale Brevo",()=>{
 assert.match(sql,/unique\(fee_year,person_id\)/);
 assert.match(cron,/resolution=ignore-duplicates/);
 assert.match(cron,/to:\[\{email,name:p\.full_name\}\]/);
 assert.match(cron,/association_fee_reminder_deliveries/);
});
test("scadenza per anno con attivazione espressa e tabelle protette",()=>{
 assert.match(sql,/constraint association_fee_reminder_due_year/);
 assert.match(sql,/enable row level security/g);
 assert.match(sql,/revoke all on public\.association_fee_reminder_settings,public\.association_fee_reminder_deliveries from public,anon,authenticated/);
 assert.match(api,/b\.confirm!==true/);
 assert.match(api,/b\.due_on\.startsWith\(year\+"-"\)/);
});
