-- Ricevuta e incasso automatico sono un'unica transazione, con retry idempotenti.
-- Nessun dato di esempio e nessuna modifica alle ricevute già presenti.
create function public.association_issue_receipt_with_income(
 p_id uuid,p_actor uuid,p_data jsonb,p_issuer jsonb,p_income jsonb
) returns public.association_receipts language plpgsql security invoker set search_path='' as $$
declare m public.association_movements; r public.association_receipts;
begin
 if p_id is null or p_actor is null then raise exception 'request id and actor required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('receipt-income:' || p_id::text,0));
 select * into r from public.association_receipts where id=p_id;
 if found then
  select * into m from public.association_movements where id=r.movement_id;
  if r.cancelled or r.created_by<>p_actor or r.data is distinct from p_data or r.issuer is distinct from p_issuer
   or jsonb_build_object('date',m.date,'kind',m.kind,'amount_cents',m.amount_cents,'account',m.account,
    'category',m.category,'project',m.project,'description',m.description,'private_note',m.private_note) is distinct from p_income then
   raise exception 'idempotency conflict' using errcode='40001';
  end if;
  return r;
 end if;
 if p_income->>'kind' is distinct from 'income'
  or (p_income->>'date')::date > (now() at time zone 'Europe/Rome')::date
  or coalesce(p_data->>'type','') not in ('donation','fundraising')
  or coalesce(p_data->>'payment','') not in ('cash','bank_transfer','card')
  or p_income->>'account' is distinct from (case when p_data->>'payment'='cash' then 'cash' else 'bank' end)
  or p_income->>'category' is distinct from (case when p_data->>'type'='donation' then 'Donazioni' else 'Raccolta fondi' end) then
  raise exception 'invalid income';
 end if;
 select * into m from public.association_save_movement(null,null,p_actor,p_income,null);
 select * into r from public.association_issue_receipt(p_id,m.id,m.version,p_actor,p_data,p_issuer);
 return r;
end $$;
revoke all on function public.association_issue_receipt_with_income(uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.association_issue_receipt_with_income(uuid,uuid,jsonb,jsonb,jsonb) to service_role;
