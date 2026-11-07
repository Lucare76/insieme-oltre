-- Quote annuali collegate atomically alla contabilità: nessun doppio incasso.
create table public.association_membership_fees (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.association_register_people(id) on delete restrict,
 fee_year integer not null check (fee_year between 2020 and 2199),
 movement_id uuid not null unique references public.association_movements(id) on delete restrict,
 amount_cents bigint not null check (amount_cents > 0),
 paid_on date not null,
 payment_account text not null check (payment_account in ('cash','bank')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique (person_id,fee_year)
);
create index association_membership_fees_year on public.association_membership_fees(fee_year,person_id);
alter table public.association_membership_fees enable row level security;
revoke all on public.association_membership_fees from public,anon,authenticated;
grant select,insert on public.association_membership_fees to service_role;
revoke update,delete on public.association_membership_fees from service_role;

-- Una singola transazione salva l'entrata e il pagamento annuale.
create function public.association_record_membership_fee(
 p_person uuid, p_year integer, p_cents bigint, p_paid_on date, p_account text, p_actor uuid
) returns uuid
language plpgsql
set search_path = ''
as $$
declare v_person public.association_register_people; v_movement uuid; v_fee uuid;
begin
 select * into v_person from public.association_register_people where id=p_person and register_kind='soci' for share;
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
revoke all on function public.association_record_membership_fee(uuid,integer,bigint,date,text,uuid) from public,anon,authenticated;
grant execute on function public.association_record_membership_fee(uuid,integer,bigint,date,text,uuid) to service_role;

-- Impedisce la modifica/cancellazione di un incasso già certificato come quota.
-- Eventuali rettifiche richiedono una procedura dedicata e tracciata.
create function public.association_protect_membership_movement()
returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.association_membership_fees where movement_id=old.id) then
  raise exception 'movimento collegato a quota associativa: modifica non consentita';
 end if;
 return new;
end $$;
create trigger association_membership_movement_guard before update or delete on public.association_movements
for each row execute function public.association_protect_membership_movement();
