import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const route=readFileSync("app/api/associazione/libri-sociali/firme/route.ts","utf8");
const schema=readFileSync("supabase/migrations/20261105190000_association_signed_documents.sql","utf8");
const ui=readFileSync("app/admin/libri-sociali/SignedDocumentsPanel.tsx","utf8");
test("firma archivio: server richiede autorizzazione registri",()=>{
 assert.match(route,/await authorize\(request,false,false,true\)/);
 assert.match(route,/const origin=await record\(source\)/);
 assert.match(route,/origin\.stage!=="original"/);
 assert.match(route,/checksum\(originalBytes\)!==origin\.sha256/);
 assert.match(route,/origin\.object_path/);
 assert.match(route,/verification:"not_verified"/);
});
test("firma archivio: storage privato e tabelle senza accesso diretto",()=>{
 assert.match(schema,/alter table public\.association_signed_documents enable row level security/);
 assert.match(schema,/revoke all on public\.association_signed_documents from public, anon, authenticated/);
 assert.match(schema,/revoke update,delete on public\.association_signed_documents from service_role/);
 assert.match(schema,/array\['application\/pdf'\]/);
 assert.match(schema,/unique index association_signed_documents_one_signed/);
});
test("firma archivio: UI non dichiara verifica automatica",()=>{
 assert.match(ui,/Firma non verificata dal sito/);
 assert.match(ui,/PAdES/);
 assert.match(ui,/SHA-256/);
});
