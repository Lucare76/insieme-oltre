-- Correzioni anagrafiche del Libro soci, senza cancellare il socio o cambiare il suo UUID.
-- Nessun accesso pubblico e nessuna UPDATE diretta sulla tabella anagrafica.
create table public.association_member_name_corrections (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.association_register_people(id) on delete restrict,
 old_name text not null,
 new_name text not null,
 reason text not null,
 changed_by uuid not null references auth.users(id),
 changed_at timestamptz not null default now()
);
create index association_member_name_corrections_person_date
 on public.association_member_name_corrections(person_id,changed_at desc);
alter table public.association_member_name_corrections enable row level security;
revoke all on public.association_member_name_corrections from public,anon,authenticated;
grant select,insert on public.association_member_name_corrections to service_role;

-- Una transazione: blocca la riga, verifica il vecchio nome, corregge e registra audit.
-- La funzione non può essere invocata da anon/authenticated; il server controlla owner/presidente.
create function public.association_correct_member_name(
 p_person uuid, p_expected_name text, p_new_name text, p_reason text, p_actor uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_person public.association_register_people;
 v_name text;
 v_reason text;
begin
 if p_person is null or p_actor is null or p_expected_name is null then
  raise exception 'Identificativi della correzione mancanti' using errcode='22023';
 end if;
 if p_new_name is null or length(p_new_name)>160 or p_new_name ~ '[[:cntrl:]]' then
  raise exception 'Nome non valido' using errcode='22023';
 end if;
 v_name := regexp_replace(btrim(p_new_name), '[[:space:]]+', ' ', 'g');
 if length(v_name)<2 then
  raise exception 'Inserisci nome e cognome corretti' using errcode='22023';
 end if;
 if p_reason is null or length(p_reason)>300 or p_reason ~ '[[:cntrl:]]' then
  raise exception 'Motivo non valido' using errcode='22023';
 end if;
 v_reason := btrim(p_reason);
 if length(v_reason)<5 then
  raise exception 'Indica il motivo della correzione' using errcode='22023';
 end if;
 select * into v_person
 from public.association_register_people
 where id=p_person and register_kind='soci' for update;
 if not found then
  raise exception 'Socio non trovato nel Libro soci' using errcode='22023';
 end if;
 if v_person.full_name is distinct from p_expected_name then
  raise exception 'Il nominativo è cambiato: aggiorna prima l''elenco' using errcode='40001';
 end if;
 if v_person.full_name = v_name then
  raise exception 'Il nuovo nome coincide con quello già registrato' using errcode='22023';
 end if;
 if exists (
  select 1 from public.association_register_people
  where register_kind='soci' and id<>p_person
   and lower(regexp_replace(btrim(full_name),'[[:space:]]+',' ','g'))=lower(v_name)
 ) then
  raise exception 'Un altro socio ha già questo nome: verifica possibili omonimie' using errcode='23505';
 end if;
 update public.association_register_people
 set full_name=v_name
 where id=p_person;
 insert into public.association_member_name_corrections(person_id,old_name,new_name,reason,changed_by)
 values (p_person,v_person.full_name,v_name,v_reason,p_actor);
 return p_person;
end $$;
revoke all on function public.association_correct_member_name(uuid,text,text,text,uuid)
 from public,anon,authenticated;
grant execute on function public.association_correct_member_name(uuid,text,text,text,uuid)
 to service_role;
