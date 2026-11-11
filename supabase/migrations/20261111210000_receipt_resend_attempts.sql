-- Reinvio di ricevute già spedite: tentativi append-only, mai nuove ricevute o incassi.
-- La funzione di prenotazione blocca la ricevuta sorgente per serializzare richieste concorrenti.
create table if not exists public.association_receipt_resend_attempts (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('general','membership')),
  source_id uuid not null,
  recipient_email text not null check (length(recipient_email) between 3 and 254),
  reason text not null check (length(reason) between 5 and 240),
  status text not null default 'sending' check (status in ('sending','sent','failed','unknown')),
  provider_message_id text,
  error_message text,
  requested_by uuid not null references auth.users(id),
  attempted_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint resend_completed_consistency check (
    (status = 'sending' and completed_at is null)
    or (status <> 'sending' and completed_at is not null)
  )
);
create index if not exists association_receipt_resend_lookup
  on public.association_receipt_resend_attempts (source, source_id, attempted_at desc);
alter table public.association_receipt_resend_attempts enable row level security;
revoke all on table public.association_receipt_resend_attempts from public, anon, authenticated;
grant select, insert, update on public.association_receipt_resend_attempts to service_role;

-- Accessibile solamente tramite API server autenticata, con service_role.
-- Un invio originario deve già risultare 'sent'; gli esiti incerti bloccano ulteriori tentativi.
create or replace function public.association_reserve_receipt_resend(
 p_source text, p_source_id uuid, p_recipient text, p_actor uuid, p_reason text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_fee public.association_membership_fees;
  v_receipt public.association_receipts;
  v_previous public.association_receipt_resend_attempts;
  v_id uuid;
  v_email text;
begin
  if p_source not in ('general','membership')
     or p_source_id is null or p_actor is null
     or p_recipient is null or length(trim(p_recipient)) not between 3 and 254
     or p_reason is null or length(trim(p_reason)) not between 5 and 240
     or p_recipient !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  then
    raise exception 'Dati di reinvio non validi.' using errcode='RR400';
  end if;
  v_email := lower(trim(p_recipient));
  if p_source = 'membership' then
    select * into v_fee from public.association_membership_fees
      where id = p_source_id and cancelled = false for update;
    if not found then raise exception 'Quota non trovata o annullata.' using errcode='RR409'; end if;
    if not exists (
      select 1 from public.association_membership_receipt_deliveries
      where fee_id = p_source_id and status = 'sent'
    ) then
      raise exception 'È necessario un primo invio confermato prima di reinviare.' using errcode='RR409';
    end if;
    if not exists (
      select 1 from public.association_member_delivery_contacts
      where person_id = v_fee.person_id and lower(trim(email)) = v_email
    ) then
      raise exception 'L’indirizzo email ufficiale è cambiato. Verifica prima la rubrica.' using errcode='RR409';
    end if;
  else
    select * into v_receipt from public.association_receipts
      where id = p_source_id and cancelled = false for update;
    if not found then raise exception 'Ricevuta non trovata o annullata.' using errcode='RR409'; end if;
    if v_receipt.mail_status <> 'sent' then
      raise exception 'È necessario un primo invio confermato prima di reinviare.' using errcode='RR409';
    end if;
    if lower(trim(coalesce(v_receipt.data->>'email',''))) <> v_email then
      raise exception 'Email diversa da quella della ricevuta. Verifica i dati originali.' using errcode='RR409';
    end if;
  end if;

  select * into v_previous from public.association_receipt_resend_attempts
  where source = p_source and source_id = p_source_id
  order by attempted_at desc, id desc limit 1;
  if found then
    if v_previous.status in ('sending','unknown') then
      raise exception 'Esiste un reinvio in corso o con esito incerto. Verifica su Brevo prima di procedere.' using errcode='RR409';
    end if;
    if v_previous.attempted_at > now() - interval '15 minutes' then
      raise exception 'Reinvio troppo ravvicinato. Attendi almeno 15 minuti prima di riprovare.' using errcode='RR409';
    end if;
  end if;
  insert into public.association_receipt_resend_attempts
    (source, source_id, recipient_email, reason, requested_by)
  values (p_source, p_source_id, v_email, trim(p_reason), p_actor)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.association_reserve_receipt_resend(text,uuid,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.association_reserve_receipt_resend(text,uuid,text,uuid,text)
  to service_role;

-- Una ricevuta non deve essere annullata durante l'invio di una sua copia.
-- Il controllo si applica unicamente al cambio da attiva ad annullata.
create or replace function public.association_guard_receipt_resend()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.cancelled is true and old.cancelled is false and exists(
    select 1 from public.association_receipt_resend_attempts
    where source = 'general' and source_id = old.id and status = 'sending'
  ) then
    raise exception 'Reinvio in corso: attendi prima di annullare la ricevuta.'
      using errcode = 'RR409';
  end if;
  return new;
end $$;
drop trigger if exists association_receipt_resend_cancel_guard on public.association_receipts;
create trigger association_receipt_resend_cancel_guard
before update of cancelled on public.association_receipts
for each row execute function public.association_guard_receipt_resend();
revoke all on function public.association_guard_receipt_resend()
  from public, anon, authenticated;
