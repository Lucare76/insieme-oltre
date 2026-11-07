import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("supabase/migrations/20261107170000_association_membership_fees.sql","utf8");
const route=readFileSync("app/api/associazione/libri-sociali/quote/route.ts","utf8");
const ui=readFileSync("app/admin/libri-sociali/MembershipFees.tsx","utf8");
const pdf=readFileSync("lib/membershipFeePdf.ts","utf8");
test("un pagamento per socio ed anno; movimento creato nella stessa transazione",()=>{
 assert.match(sql,/unique \(person_id,fee_year\)/);
 assert.match(sql,/insert into public\.association_movements/);
 assert.match(sql,/insert into public\.association_membership_fees/);
 assert.match(sql,/category,project,description,private_note/);
 assert.match(sql,/'Quote associative'/);
 assert.match(sql,/association_membership_movement_guard before update or delete/);
});
test("nessun accesso diretto e non modificabilità delle quote",()=>{
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.association_membership_fees from public,anon,authenticated/);
 assert.match(sql,/revoke update,delete on public\.association_membership_fees from service_role/);
 assert.match(sql,/revoke all on function public\.association_record_membership_fee/);
 assert.match(route,/authorize\(req,false,false,true\)/);
});
test("registrazione solo con conferma e validazione; PDF senza donazione",()=>{
 assert.match(route,/b\.confirm!==true/);
 assert.match(route,/parseCents\(b\.amount\)/);
 assert.match(route,/validDate\(b\.paid_on\)/);
 assert.match(route,/association_record_membership_fee/);
 assert.match(pdf,/RICEVUTA QUOTA ASSOCIATIVA/);\n assert.match(pdf,/La quota associativa non è un.erogazione liberale/);\n assert.match(pdf,/RECEIPT_ISSUER_TAX_CODE/);\n assert.match(pdf,/Codice fiscale del socio/);\n assert.match(pdf,/receiptNumber = "QA\/" \+ fee.fee_year \+ "\/" \+ fee.id.toUpperCase/);\n assert.match(route,/filename="ricevuta-quota-associativa-/);\n assert.match(ui,/Scarica ricevuta PDF/);
 assert.match(pdf,/logo\.png/);
 assert.match(ui,/non è già stata registrata in Contabilità/);
});
