-- Completa i dati anagrafici senza modificare ammissione, UUID, quote e tessere.
alter table public.association_register_people
 add column birth_place text not null default '' check (length(birth_place)<=160),
 add column residence text not null default '' check (length(residence)<=250);

create table public.association_member_profile_changes (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.association_register_people(id) on delete restrict,
 old_data jsonb not null,
 new_data jsonb not null,
 changed_by uuid not null references auth.users(id),
 changed_at timestamptz not null default now()
);
alter table public.association_member_profile_changes enable row level security;
revoke all on public.association_member_profile_changes from public, anon, authenticated;
grant select on public.association_member_profile_changes to service_role;

create or replace function public.association_update_member_profile(
 p_person uuid, p_actor uuid, p_fiscal_code text, p_birth_date date,
 p_birth_place text, p_residence text, p_notes text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
 v_person public.association_register_people%rowtype;
 v_cf text := upper(btrim(coalesce(p_fiscal_code,'')));
 v_bp text := btrim(coalesce(p_birth_place,''));
 v_res text := btrim(coalesce(p_residence,''));
 v_notes text := btrim(coalesce(p_notes,''));
 v_old jsonb; v_new jsonb;
begin
 if p_person is null or not exists(select 1 from auth.users where id=p_actor) then
  raise exception 'Identificativi non validi' using errcode='22023';
 end if;
 if (v_cf<>'' and v_cf !~ '^[A-Z0-9]{16}$')
    or length(v_bp)>160 or length(v_res)>250 or length(v_notes)>500
    or v_bp ~ '[[:cntrl:]]' or v_res ~ '[[:cntrl:]]' or v_notes ~ '[[:cntrl:]]'
    or (p_birth_date is not null and (p_birth_date>current_date or p_birth_date<date '1900-01-01')) then
  raise exception 'Controlla i dati anagrafici' using errcode='22023';
 end if;
 select * into v_person from public.association_register_people
  where id=p_person and register_kind='soci' for update;
 if not found then
  raise exception 'Socio non trovato' using errcode='P0002';
 end if;
 if v_cf<>'' and exists(select 1 from public.association_register_people
    where register_kind='soci' and id<>p_person and upper(btrim(fiscal_code))=v_cf) then
  raise exception 'Codice fiscale già associato a un altro socio' using errcode='23505';
 end if;
 v_old := jsonb_build_object('fiscal_code',v_person.fiscal_code,'birth_date',v_person.birth_date,
  'birth_place',v_person.birth_place,'residence',v_person.residence,'notes',v_person.notes);
 v_new := jsonb_build_object('fiscal_code',v_cf,'birth_date',p_birth_date,
  'birth_place',v_bp,'residence',v_res,'notes',v_notes);
 if v_old=v_new then return p_person; end if;
 update public.association_register_people
 set fiscal_code=v_cf,birth_date=p_birth_date,birth_place=v_bp,residence=v_res,notes=v_notes
 where id=p_person;
 insert into public.association_member_profile_changes(person_id,old_data,new_data,changed_by)
 values(p_person,v_old,v_new,p_actor);
 return p_person;
end;
$$;
revoke all on function public.association_update_member_profile(uuid,uuid,text,date,text,text,text)
 from public,anon,authenticated;
grant execute on function public.association_update_member_profile(uuid,uuid,text,date,text,text,text)
 to service_role;
