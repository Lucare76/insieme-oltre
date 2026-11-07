import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const before = readFileSync("supabase/migrations/20261107170000_association_membership_fees.sql", "utf8");
const fix = readFileSync("supabase/migrations/20261107223000_fix_membership_fee_lock_privilege.sql", "utf8");
const api = readFileSync("app/api/associazione/libri-sociali/quote/route.ts", "utf8");

test("la correzione elimina il lock incompatibile con i permessi minimi service_role", () => {
 assert.match(before, /register_kind='soci' for share/);
 assert.match(fix, /create or replace function public\.association_record_membership_fee/);
 assert.match(fix, /register_kind='soci';/);
 assert.doesNotMatch(fix, /\bfor share\s*;/i);
 assert.doesNotMatch(fix, /security definer/i);
 assert.doesNotMatch(fix, /grant (all|update|delete)/i);
});

test("la transazione mantiene una quota e un incasso senza inserimenti diretti nella API", () => {
 assert.match(fix, /insert into public\.association_movements/);
 assert.match(fix, /insert into public\.association_membership_fees/);
 assert.match(fix, /if exists\(select 1 from public\.association_membership_fees where person_id=p_person and fee_year=p_year\)/);
 assert.match(api, /rpc\/association_record_membership_fee/);
});
