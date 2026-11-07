import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const ui=readFileSync("app/admin/libri-sociali/MembershipFees.tsx","utf8");
const api=readFileSync("app/api/associazione/libri-sociali/quote/route.ts","utf8");
const sql=readFileSync("supabase/migrations/20261107170000_association_membership_fees.sql","utf8");

test("pulsante registra quota risponde con messaggi anche quando mancano dati",()=>{
 assert.match(ui,/<form noValidate onSubmit=\{e=>void save\(e\)\}>/);
 assert.match(ui,/disabled=\{busy\}>\{busy\?"Registrazione in corso/);
 assert.match(ui,/Seleziona un socio dal menu a tendina/);
 assert.match(ui,/Inserisci un importo valido/);
 assert.match(ui,/Spunta la casella per confermare/);
 assert.match(ui,/role="status" aria-live="polite"/);
 assert.match(ui,/\{paymentMessage\}/);
});

test("protegge da doppio clic e non dichiara successo senza conferma dell'API",()=>{
 assert.match(ui,/const submission=useRef\(false\)/);
 assert.match(ui,/if\(submission.current\)return/);
 assert.match(ui,/submission.current=true/);
 assert.match(ui,/submission.current=false/);
 assert.match(ui,/if\(!result.ok\|\|!result.id\)throw/);
 assert.match(api,/association_record_membership_fee/);
 assert.match(sql,/unique \(person_id,fee_year\)/);
 assert.match(sql,/insert into public\.association_movements/);
});

test("su esito incerto rilegge lo storico e avvisa di non registrare di nuovo",()=>{
 assert.match(ui,/const latest=await response.json\(\) as Data/);
 assert.match(ui,/latest.fees.some\(f=>f.person_id===submittedPerson\)/);
 assert.match(ui,/NON registrarla di nuovo/);
 assert.match(ui,/Esito incerto: verifica lo storico quote e la Contabilità/);
 assert.match(ui,/Quota e incasso salvati correttamente/);
});
