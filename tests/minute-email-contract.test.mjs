import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const route=readFileSync("app/api/associazione/libri-sociali/distribuzione/route.ts","utf8");
const schema=readFileSync("supabase/migrations/20261107150000_association_minute_email_delivery.sql","utf8");
const ui=readFileSync("app/admin/libri-sociali/MinuteDistribution.tsx","utf8");
test("solo assemblee e verbali approvati",()=>{
 assert.match(route,/meeting_kind!=="assemblee"/);
 assert.match(route,/if\(!minute\.approved\)/);
 assert.match(route,/await authorize\(req,false,false,true\)/);
});
test("solo soci attivi e rubrica esplicita",()=>{
 assert.match(route,/register_kind=eq\.soci/);
 assert.match(route,/people\.filter\(p=>!p\.ended_on\)/);
 assert.match(route,/eligible\.some\(p=>!emailOK\(p\.email\)\)/);
 assert.match(route,/duplicates\.length/);
});
test("conferma e traccia invii individuali",()=>{
 assert.match(route,/body\.confirm!==true/);
 assert.match(route,/digest\(data\.recipients\)!==body\.fingerprint/);
 assert.match(route,/if\(previous\.length\)/);
 assert.match(route,/to:\[\{email:recipient\.email/);
 assert.match(route,/attachment:\[\{name:/);
 assert.match(schema,/unique\(minute_id,person_id\)/);
 assert.match(schema,/enable row level security/);
 assert.match(ui,/Ho verificato i destinatari/);
 assert.match(ui,/non è automaticamente firmato digitalmente/);
});
