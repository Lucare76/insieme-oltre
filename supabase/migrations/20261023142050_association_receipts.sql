-- Nessun incasso o ricevuta di esempio. Accesso solo attraverso API autorizzate.
create table public.association_receipts (
 id uuid primary key,
 number integer generated always as identity unique,
 issued_on date not null default (now() at time zone 'Europe/Rome')::date,
 movement_id uuid not null references public.association_movements(id),
 data jsonb not null, issuer jsonb not null,
 amount_cents bigint not null check(amount_cents > 0), payment_date date not null,
 created_by uuid not null references auth.users(id),
 cancelled boolean not null default false, cancellation_reason text,
 updated_by uuid not null references auth.users(id),
 mail_status text not null default 'pending' check(mail_status in ('pending','sending','sent','unknown')),
 sent_at timestamptz, provider_id text,
 pdf_base64 text, created_at timestamptz not null default now()
);
create unique index association_receipts_active_movement on public.association_receipts(movement_id) where not cancelled;
alter table public.association_receipts enable row level security;
revoke all on public.association_receipts from public,anon,authenticated;
grant select,insert,update on public.association_receipts to service_role;
grant usage,select on sequence public.association_receipts_number_seq to service_role;

create function public.association_issue_receipt(p_id uuid,p_movement uuid,p_version integer,p_actor uuid,p_data jsonb,p_issuer jsonb)
returns public.association_receipts language plpgsql security invoker set search_path='' as $$
declare m public.association_movements; r public.association_receipts;
begin
 -- Lock the movement to serialize double clicks, retries, and concurrent changes.
 select * into m from public.association_movements where id=p_movement for update;
 select * into r from public.association_receipts where id=p_id;
 if found then
  if r.movement_id<>p_movement or r.data<>p_data or r.issuer<>p_issuer then raise exception 'idempotency conflict' using errcode='40001'; end if;
  return r;
 end if;
 if m.id is null or m.version<>p_version or m.cancelled or m.kind<>'income'
  or m.date>(now() at time zone 'Europe/Rome')::date then
  raise exception 'invalid movement' using errcode='40001';
 end if;
 if exists(select 1 from public.association_receipts where movement_id=p_movement and not cancelled) then
  raise exception 'receipt already issued' using errcode='40001';
 end if;
 insert into public.association_receipts(id,movement_id,data,issuer,amount_cents,payment_date,created_by,updated_by)
 values(p_id,p_movement,p_data,p_issuer,m.amount_cents,m.date,p_actor,p_actor) returning * into r;
 insert into public.association_audit(entity,entity_id,actor_id,action,after_data)
 values('association_receipts',r.id,p_actor,'issue',to_jsonb(r));
 return r;
end $$;
revoke all on function public.association_issue_receipt(uuid,uuid,integer,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.association_issue_receipt(uuid,uuid,integer,uuid,jsonb,jsonb) to service_role;

create function public.association_guard_receipt() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (to_jsonb(new)-array['cancelled','cancellation_reason','updated_by','mail_status','sent_at','provider_id','pdf_base64'])
  is distinct from (to_jsonb(old)-array['cancelled','cancellation_reason','updated_by','mail_status','sent_at','provider_id','pdf_base64'])
  or (old.pdf_base64 is not null and new.pdf_base64 is distinct from old.pdf_base64)
  or (old.cancelled and not new.cancelled) then raise exception 'receipt immutable'; end if;
 if new.cancelled and not old.cancelled and (old.mail_status='sending' or length(trim(coalesce(new.cancellation_reason,''))) not between 10 and 500)
  then raise exception 'invalid cancellation'; end if;
 insert into public.association_audit(entity,entity_id,actor_id,action,reason,before_data,after_data)
 values('association_receipts',new.id,new.updated_by,
  case when new.cancelled and not old.cancelled then 'cancel' else 'receipt_status' end,
  coalesce(new.cancellation_reason,''),to_jsonb(old)-'pdf_base64',to_jsonb(new)-'pdf_base64');
 return new;
end $$;
revoke all on function public.association_guard_receipt() from public,anon,authenticated;
grant execute on function public.association_guard_receipt() to service_role;
create trigger association_receipt_guard before update on public.association_receipts for each row execute function public.association_guard_receipt();

create function public.association_guard_receipted_movement() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.association_receipts where movement_id=old.id and not cancelled) then
  raise exception 'cancel receipt first' using errcode='40001';
 end if;
 return new;
end $$;
revoke all on function public.association_guard_receipted_movement() from public,anon,authenticated;
grant execute on function public.association_guard_receipted_movement() to service_role;
create trigger association_movement_receipt_guard before update on public.association_movements for each row execute function public.association_guard_receipted_movement();
