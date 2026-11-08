import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(p,"utf8");
const auth=read("lib/associationServer.ts");
const book=read("app/admin/libri-sociali/page.tsx");
const admin=read("app/admin/page.tsx");
const requests=read("app/admin/accessComponents.tsx");
const accountsApi=read("app/api/associazione/libri-sociali/iscrizioni/route.ts");
const bookAccounts=read("app/admin/libri-sociali/MembershipAccountMatches.tsx");
const common=read("lib/accounting.ts");

test("tesoriere entra nei Libri sociali mantenendo escluse le semplici utenze socio",()=>{
 assert.match(auth,/registers && !\["owner","president","accountant"\]\.includes\(user\.role\)/);
 assert.match(book,/\["owner","president","accountant"\]\.includes\(me\.user\.role\)/);
 assert.match(admin,/user\.role === "owner" \|\| user\.role === "president" \|\| user\.role === "accountant"/);
 assert.match(common,/accountant: "Tesoriere — contabilità e libri sociali"/);
 assert.match(requests,/Tesoriere — contabilità e libri sociali/);
 assert.match(auth,/user\.role === "none"/);
});

test("account approvato non viene automaticamente inserito nel Libro soci",()=>{
 assert.match(accountsApi,/activated_at:a\.activated_at/);
 assert.match(accountsApi,/select=user_id,name,email,role,psychologist,active,activated_at/);
 assert.match(bookAccounts,/!r\.in_book&&r\.matches\.length===0/);
 assert.match(bookAccounts,/Accesso digitale non prova l.iscrizione|accesso digitale non prova l.iscrizione|accesso digitale non prova l.iscrizione/i);
 assert.match(bookAccounts,/Invito approvato, account non ancora attivato/);
 assert.match(bookAccounts,/Confermo che \{a\.name\} è stato formalmente ammesso/);
 assert.match(bookAccounts,/confirm_membership:true/);
 assert.match(bookAccounts,/admitted_on:admittedOn/);
});

test("il server richiede prova esplicita di ammissione e impedisce duplicati",()=>{
 assert.match(accountsApi,/b\.confirm_membership!==true/);
 assert.match(accountsApi,/const existingByEmail=registered\.contacts\.find/);
 assert.match(accountsApi,/const existingByName=registered\.people\.find/);
 assert.match(accountsApi,/if\(existingByEmail\|\|existingByName\)/);
 assert.match(accountsApi,/person_id:person\.id,email:mail/);
});
