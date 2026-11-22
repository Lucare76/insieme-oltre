-- Il ruolo associativo NON concede permessi di accesso all'admin.
-- I registri ufficiali restano separati dalle candidature.
alter table public.association_volunteer_applications
  add column association_role text not null default 'volontario'
    check (association_role in ('volontario','socio','socio_volontario')),
  add column member_person_id uuid references public.association_register_people(id),
  add constraint volunteer_member_link_required
    check (association_role = 'volontario' or member_person_id is not null);

create unique index volunteer_member_person_unique
  on public.association_volunteer_applications(member_person_id)
  where member_person_id is not null;

-- Conversione atomica, riservata al service_role. Controlla duplicati nel Libro soci.
create or replace function public.association_promote_volunteer_to_member(
  p_application uuid,
  p_actor uuid,
  p_admitted_on date,
  p_role text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate public.association_volunteer_applications%rowtype;
  v_member uuid;
  v_today date := (now() at time zone 'Europe/Rome')::date;
begin
  if p_role not in ('socio','socio_volontario') then
    raise exception 'Ruolo non valido' using errcode = '22023';
  end if;
  if p_admitted_on is null or p_admitted_on > v_today or p_admitted_on < date '2000-01-01' then
    raise exception 'Data di ammissione non valida' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_actor) then
    raise exception 'Amministratore non valido' using errcode = '22023';
  end if;
  select * into v_candidate from public.association_volunteer_applications
    where id = p_application for update;
  if not found then
    raise exception 'Candidatura non trovata' using errcode = 'P0002';
  end if;
  if v_candidate.member_person_id is not null then
    raise exception 'Candidatura già iscritta: modifica soltanto il ruolo di partecipazione' using errcode = '23505';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(4042026);
  if exists (
    select 1 from public.association_register_people p
    where p.register_kind = 'soci'
      and p.ended_on is null
      and lower(regexp_replace(trim(p.full_name), '[[:space:]]+', ' ', 'g'))
        = lower(regexp_replace(trim(v_candidate.name), '[[:space:]]+', ' ', 'g'))
  ) then
    raise exception 'Socio già presente nel Libro soci: verificare il nominativo prima di procedere' using errcode = '23505';
  end if;
  insert into public.association_register_people
    (register_kind,full_name,admitted_on,created_by)
  values ('soci',upper(trim(v_candidate.name)),p_admitted_on,p_actor)
  returning id into v_member;
  update public.association_volunteer_applications
    set member_person_id = v_member,
        association_role = p_role,
        status = 'active',
        updated_at = now()
  where id = p_application;
  return v_member;
end;
$$;
revoke all on function public.association_promote_volunteer_to_member(uuid,uuid,date,text)
  from public,anon,authenticated;
grant execute on function public.association_promote_volunteer_to_member(uuid,uuid,date,text)
  to service_role;
