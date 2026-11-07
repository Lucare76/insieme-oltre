import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const panel=readFileSync("app/admin/ReceiptsPanel.tsx","utf8");
const form=readFileSync("app/admin/MembershipReceiptForm.tsx","utf8");
const receiptsRoute=readFileSync("app/api/associazione/ricevute/route.ts","utf8");
const membershipRoute=readFileSync("app/api/associazione/libri-sociali/quote/route.ts","utf8");

test("Nuova ricevuta mostra esplicitamente Quota associativa",()=>{
 assert.match(panel,/<option value="membership">Quota associativa<\/option>/);
 assert.match(panel,/type === "membership"/);
 assert.match(panel,/<MembershipReceiptForm api=\{api\}/);
 assert.match(panel,/type !== "membership"/);
});

test("registrazione di quota usa il flusso esistente e non la RPC donazioni",()=>{
 assert.match(form,/api\(base, \{/);
 assert.match(form,/person_id: personId, year, amount, paid_on: paidOn, account, confirm: true/);
 assert.match(form,/Registra quota e scarica ricevuta/);
 assert.match(form,/api\(base \+ "\?receipt="/);
 assert.match(form,/Scarica ricevuta PDF/);
 assert.match(membershipRoute,/association_record_membership_fee/);
});

test("nessun incasso doppio se il download della ricevuta fallisce",()=>{
 assert.match(form,/Dopo la registrazione non ripetere mai il POST/);
 assert.match(form,/seleziona il versamento esistente e riscarica la ricevuta/);
 assert.match(form,/setMode\("existing"\)/);
 assert.match(form,/setFeeId\(savedId\)/);
});

test("quote non possono essere emesse come donazioni o raccolte fondi",()=>{
 assert.match(panel,/m.category !== "Quote associative"/);
 assert.match(receiptsRoute,/movement.category === "Quote associative"/);
 assert.match(receiptsRoute,/seleziona Quota associativa nella schermata Ricevute/);
});

test("un contabile senza permesso al Libro soci vede messaggio informativo",()=>{
 assert.match(form,/e.status === 403/);
 assert.match(form,/Admin principale o Presidente/);
});
