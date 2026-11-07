import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path)=>readFileSync(path,"utf8");
const migration=read("supabase/migrations/20261107210000_association_membership_receipt_deliveries.sql");
const send=read("app/api/associazione/libri-sociali/quote/invio/route.ts");
const quotes=read("app/api/associazione/libri-sociali/quote/route.ts");
const form=read("app/admin/MembershipReceiptForm.tsx");
const ledger=read("app/admin/libri-sociali/MembershipFees.tsx");
const link=read("app/api/associazione/libri-sociali/iscrizioni/route.ts");
const linksUi=read("app/admin/libri-sociali/MembershipAccountMatches.tsx");
const distribution=read("app/api/associazione/libri-sociali/distribuzione/route.ts");

test("la ricevuta annuale è inviata soltanto su conferma e con contatto ufficiale",()=>{
 assert.match(send,/authorize\(req,false,false,true\)/);
 assert.match(send,/body\.confirm!==true/);
 assert.match(send,/body\.confirm_email\.trim\(\)\.toLowerCase\(\)!==email/);
 assert.match(send,/association_member_delivery_contacts/);
 assert.match(send,/association_membership_fees/);
 assert.match(send,/membershipFeePdf/);
 assert.match(send,/api\.brevo\.com\/v3\/smtp\/email/);
 assert.match(send,/attachment:\[\{name:/);
});

test("lo storico invii evita doppie email anche con richieste concorrenti",()=>{
 assert.match(migration,/fee_id uuid not null unique/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all on public\.association_membership_receipt_deliveries from public,anon,authenticated/);
 assert.match(send,/resolution=ignore-duplicates,return=representation/);
 assert.match(send,/if\(reserved.length!==1\)/);
 assert.match(send,/status:state/);
 assert.match(send,/state="unknown"/);
 assert.match(form,/Confermo il destinatario e autorizzo l.invio/);
 assert.match(ledger,/Invia ricevuta via email/);
});

test("le cessazioni future non escludono dal Libro e dalla registrazione",()=>{
 assert.match(form,/!p.ended_on \|\| p.ended_on >= paidOn/);
 assert.match(ledger,/!p.ended_on\|\|p.ended_on>=paidOn/);
 assert.match(distribution,/!p.ended_on\|\|p.ended_on>=now/);
 assert.match(distribution,/person\[0\].ended_on<new Intl\.DateTimeFormat/);
});

test("associa gli account solo a soci già iscritti e richiede approvazione per nomi simili",()=>{
 assert.match(link,/b.action==="link_existing"/);
 assert.match(link,/confirm_link!==true/);
 assert.match(link,/quality==="similar"&&b.confirm_names!==true/);
 assert.match(link,/account.email.trim\(\).toLowerCase\(\)/);
 assert.match(link,/già associata a un altro socio/);
 assert.match(linksUi,/Possibili corrispondenze/);
 assert.match(linksUi,/Ho verificato che si tratta della stessa persona/);
 assert.match(linksUi,/Rubrica ufficiale email/);
});

test("quote non sono create di nuovo durante gli invii",()=>{
 assert.match(quotes,/association_membership_receipt_deliveries/);
 assert.match(form,/sendReceipt\(selectedFee.id,selectedFee.email\)/);
 assert.doesNotMatch(send,/association_record_membership_fee/);
 assert.doesNotMatch(send,/insert into public\.association_movements/);
});
