import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const api=readFileSync("app/api/associazione/libri-sociali/iscrizioni/route.ts","utf8");
const ui=readFileSync("app/admin/libri-sociali/MinuteDistribution.tsx","utf8");
test("iscrizioni attive, ruoli selezionati, autorizzazione",()=>{
 assert.match(api,/authorize\(req,false,false,true\)/);
 assert.match(api,/association_members\?active=eq.true/);
 assert.match(api,/\["member","president","accountant"\]/);
});
test("import solo dopo verifica formale e data",()=>{
 assert.match(api,/b\.confirm_membership!==true/);
 assert.match(api,/validDate\(b\.admitted_on\)/);
 assert.match(api,/existingByEmail\|\|existingByName/);
 assert.match(ui,/Confermo che questa persona è stata formalmente ammessa/);
});
test("recupero indirizzo e ricaricamento destinatari",()=>{
 assert.match(api,/association_member_delivery_contacts/);
 assert.match(api,/register_kind:"soci"/);
 assert.match(ui,/loadContacts\(\),loadRegistrations\(\)/);
 assert.match(ui,/if\(minute\)await loadPreview\(minute\)/);
});
