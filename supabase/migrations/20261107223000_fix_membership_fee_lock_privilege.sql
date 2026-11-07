-- Ripara il salvataggio della quota annuale: PostgreSQL SELECT ... FOR SHARE
-- richiede privilegi di scrittura sul Libro soci. service_role ha volutamente
-- solo SELECT/INSERT su association_register_people e non UPDATE.
-- Leggiamo il socio senza blocco di riga: nessun permesso aggiuntivo concesso.
-- UNIQUE(person_id,fee_year) e la transazione RPC continuano a impedire doppi incassi.
-- Nessun cambiamento a dati, ricevute, stato pagamenti o permessi RLS.
create or replace function public.association_record_membership_fee(
 p_person uuid, p_year integer, p_cents bigint, p_paid_on date, p_account text, p_actor uuid
) returns uuid
language plpgsql
set search_path = ''
as $$
declare v_person public.association_register_people; v_movement uuid; v_fee uuid;
begin
 select * into v_person from public.association_register_people where id=p_person and register_kind='soci';
 if not found or (v_person.ended_on is not null and v_person.ended_on<p_paid_on) then
  raise exception 'socio non attivo alla data del pagamento';
 end if;
 if p_year<extract(year from v_person.admitted_on)::integer or p_year>extract(year from current_date)::integer+1
    or p_year<2020 or p_cents is null or p_cents<=0 or p_cents>100000000
    or p_paid_on is null or p_paid_on>current_date or p_paid_on<v_person.admitted_on
    or p_account not in ('bank','cash') or p_actor is null then
  raise exception 'dati della quota associativa non validi';
 end if;
 if exists(select 1 from public.association_membership_fees where person_id=p_person and fee_year=p_year) then
  raise exception 'quota associativa già registrata per questo anno' using errcode='23505';
 end if;
 insert into public.association_movements(date,kind,amount_cents,account,category,project,description,private_note,created_by,updated_by)
 values(p_paid_on,'income',p_cents,p_account,'Quote associative','',
 'Quota associativa '||p_year::text||' - '||v_person.full_name,'',p_actor,p_actor)
 returning id into v_movement;
 insert into public.association_membership_fees(person_id,fee_year,movement_id,amount_cents,paid_on,payment_account,created_by)
 values(p_person,p_year,v_movement,p_cents,p_paid_on,p_account,p_actor)
 returning id into v_fee;
 return v_fee;
end $$;
