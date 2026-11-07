import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const migration=readFileSync("supabase/migrations/20261107220000_association_member_name_corrections.sql","utf8");
const route=readFileSync("app/api/associazione/libri-sociali/route.ts","utf8");
const ui=readFileSync("app/admin/libri-sociali/page.tsx","utf8");

test("correzione nominativo è riservata a owner/presidente, con conferma",()=>{
 assert.match(route,/authorize\(request, false, false, true\)/);
 assert.match(route,/request.method==="PATCH"/);
 assert.match(route,/body.kind!=="soci"/);
 assert.match(route,/body.confirm!==true/);
 assert.match(route,/uuid\(body.person_id\)/);
 assert.match(route,/p_expected_name:expectedName/);
 assert.match(route,/p_reason:reason/);
 assert.match(route,/p_actor:actor.id/);
});

test("storico immutabile e aggiornamento del solo nome nella stessa transazione",()=>{
 assert.match(migration,/create table public.association_member_name_corrections/);
 assert.match(migration,/old_name text not null/);
 assert.match(migration,/new_name text not null/);
 assert.match(migration,/changed_by uuid not null references auth.users\(id\)/);
 assert.match(migration,/security definer/);
 assert.match(migration,/where id=p_person and register_kind='soci' for update/);
 assert.match(migration,/v_person.full_name is distinct from p_expected_name/);
 assert.match(migration,/update public.association_register_people\s+set full_name=v_name\s+where id=p_person/);
 assert.match(migration,/insert into public.association_member_name_corrections/);
 assert.doesNotMatch(migration,/delete from public.association_register_people/);
});

test("funzione protetta da accessi pubblici senza UPDATE diretto al service_role",()=>{
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all on public.association_member_name_corrections from public,anon,authenticated/);
 assert.match(migration,/revoke all on function public.association_correct_member_name[\s\S]*from public,anon,authenticated/);
 assert.match(migration,/grant execute on function public.association_correct_member_name[\s\S]*to service_role/);
 assert.doesNotMatch(migration,/grant update on public.association_register_people/);
});

test("interfaccia corregge la persona esistente e mostra lo storico",()=>{
 assert.match(ui,/>Correggi nome<\/button>/);
 assert.match(ui,/method:"PATCH"/);
 assert.match(ui,/person_id:nameEdit.id/);
 assert.match(ui,/expected_name:nameEdit.expected_name/);
 assert.match(ui,/reason:nameEdit.reason/);
 assert.match(ui,/confirm:nameEdit.confirmed/);
 assert.match(ui,/Storico correzioni nominativi/);
 assert.match(ui,/ricevute PDF già inviate non vengono richiamate/);
});
