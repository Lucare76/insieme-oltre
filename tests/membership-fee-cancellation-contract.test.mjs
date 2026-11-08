import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path)=>readFileSync(path,"utf8");
const sql=read("supabase/migrations/20261108190000_cancel_membership_fee_with_movement.sql");
const accounting=read("app/api/associazione/[...path]/route.ts");
const panel=read("app/admin/page.tsx");
const fees=read("app/api/associazione/libri-sociali/quote/route.ts");
const mail=read("app/api/associazione/libri-sociali/quote/invio/route.ts");
const cron=read("app/api/cron/quote-associative/route.ts");
const ui=read("app/admin/libri-sociali/MembershipFees.tsx");

test("rettifica atomica: sia quota sia movimento sono annullati e auditati",()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.association_cancel_membership_fee/);
 assert.match(sql,/SECURITY DEFINER SET search_path=''/);
 assert.match(sql,/UPDATE public\.association_membership_fees SET cancelled=true/);
 assert.match(sql,/UPDATE public\.association_movements SET cancelled=true/);
 assert.match(sql,/INSERT INTO public\.association_audit\(entity,entity_id,actor_id,action,reason,before_data,after_data\)/);
 assert.match(sql,/v_movement\.version<>p_version/);
 assert.match(sql,/length\(trim\(p_reason\)\) NOT BETWEEN 10 AND 500/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.association_cancel_membership_fee\(uuid,integer,uuid,text\) TO service_role/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.association_cancel_membership_fee\(uuid,integer,uuid,text\)/);
});

test("non si eliminano movimenti e non si ritoccano quote in modo arbitrario",()=>{
 assert.match(sql,/DROP CONSTRAINT association_membership_fees_person_id_fee_year_key/);
 assert.match(sql,/WHERE NOT cancelled/);
 assert.match(sql,/TG_OP='DELETE'/);
 assert.match(sql,/RAISE EXCEPTION 'movimento collegato a quota associativa: eliminazione vietata'/);
 assert.match(sql,/v_fee\.cancelled_by=new\.updated_by/);
 assert.match(sql,/v_fee\.cancellation_reason=new\.cancellation_reason/);
 assert.match(sql,/receipt_deliveries[\s\S]*WHERE fee_id=v_fee\.id/);
 assert.match(sql,/association_receipts[\s\S]*WHERE movement_id=p_movement AND NOT cancelled/);
 assert.doesNotMatch(sql,/DELETE FROM public\.association_movements/i);
 assert.doesNotMatch(sql,/DELETE FROM public\.association_membership_fees/i);
});

test("API seleziona la RPC per quote e blocca ricevute già tentate",()=>{
 assert.match(accounting,/association_membership_fees\?movement_id=eq\./);
 assert.match(accounting,/association_cancel_membership_fee/);
 assert.match(accounting,/membership_fee_cancelled:true/);
 assert.match(accounting,/association_membership_receipt_deliveries\?fee_id=eq/);
 assert.match(accounting,/association_receipts\?movement_id=eq/);
 assert.match(panel,/La rettifica annullerà sia l'entrata in Contabilità sia la quota nel Libro soci/);
 assert.match(panel,/Motivo dell’annullamento/);
 assert.match(panel,/membership_fee_cancelled/);
});

test("quote annullate non contano come pagate e non generano ricevute o email",()=>{
 assert.match(fees,/cancelled=eq\.false&select=id,person_id,fee_year,movement_id/);
 assert.match(fees,/cancelled=eq\.true&select=id,person_id,amount_cents/);
 assert.match(mail,/cancelled=eq\.false&select=id,person_id,fee_year/);
 assert.match(cron,/cancelled=eq\.false&select=person_id/);
 assert.match(ui,/Storico quote annullate/);
 assert.match(ui,/cancellation_reason/);
});
