-- Accesso esclusivamente dalle API server, dopo verifica Auth e ruolo sul database.
create table public.association_members (
 user_id uuid primary key references auth.users(id), name text not null check (length(name) between 1 and 120),
 email text not null, role text not null check(role in ('accountant','member')), active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.association_movements (
 id uuid primary key default gen_random_uuid(), date date not null check(date between '2000-01-01' and '2199-12-31'),
 kind text not null check(kind in ('income','expense','transfer','opening')),
 amount_cents bigint not null check(amount_cents > 0 and amount_cents <= 9999999999),
 account text not null check(account in ('cash','bank')), category text not null check(length(category) between 1 and 100),
 project text not null default '' check(length(project)<=120), description text not null check(length(description) between 1 and 500),
 private_note text not null default '' check(length(private_note)<=1000),
 version integer not null default 1, cancelled boolean not null default false, cancellation_reason text,
 created_by uuid not null references auth.users(id), updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index association_movements_date_idx on public.association_movements(date desc,id);
create table public.association_audit (
 id bigint generated always as identity primary key, entity text not null, entity_id uuid not null,
 actor_id uuid not null references auth.users(id), action text not null, reason text not null default '',
 before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
create table public.association_documents (
 id uuid primary key default gen_random_uuid(), movement_id uuid not null references public.association_movements(id),
 filename text not null, content_type text not null, object_path text not null unique,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
alter table public.association_members enable row level security;
alter table public.association_movements enable row level security;
alter table public.association_audit enable row level security;
alter table public.association_documents enable row level security;
revoke all on public.association_members,public.association_movements,public.association_audit,public.association_documents from anon,authenticated;
grant select,insert,update,delete on public.association_members,public.association_movements,public.association_audit,public.association_documents to service_role;
grant usage,select on sequence public.association_audit_id_seq to service_role;
-- Trigger invoker: audit e modifica sono parte della stessa transazione.
create function public.association_track_change() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then
  insert into public.association_audit(entity,entity_id,actor_id,action,after_data)
   values(TG_TABLE_NAME,new.id,new.created_by,'create',to_jsonb(new));
 else
  new.version := old.version+1; new.updated_at := now();
  insert into public.association_audit(entity,entity_id,actor_id,action,reason,before_data,after_data)
   values(TG_TABLE_NAME,new.id,new.updated_by,case when new.cancelled then 'cancel' else 'update' end,
     coalesce(new.cancellation_reason,''),to_jsonb(old),to_jsonb(new));
 end if;
 return new;
end $$;
revoke all on function public.association_track_change() from public,anon,authenticated;
grant execute on function public.association_track_change() to service_role;
create trigger association_movement_audit before insert or update on public.association_movements for each row execute function public.association_track_change();
-- Versione attesa obbligatoria: impedisce sovrascritture simultanee.
create function public.association_save_movement(p_id uuid,p_version integer,p_actor uuid,p_data jsonb,p_cancel_reason text default null)
returns public.association_movements language plpgsql security invoker set search_path='' as $$
declare result public.association_movements;
begin
 if p_id is null then
  insert into public.association_movements(date,kind,amount_cents,account,category,project,description,private_note,created_by,updated_by)
  values((p_data->>'date')::date,p_data->>'kind',(p_data->>'amount_cents')::bigint,p_data->>'account',p_data->>'category',p_data->>'project',p_data->>'description',p_data->>'private_note',p_actor,p_actor) returning * into result;
 else
  select * into result from public.association_movements where id=p_id for update;
  if not found or result.version<>p_version or result.cancelled then raise exception 'stale movement' using errcode='40001'; end if;
  if p_cancel_reason is not null then
   if length(trim(p_cancel_reason))<10 or length(p_cancel_reason)>500 then raise exception 'invalid reason'; end if;
   update public.association_movements set cancelled=true,cancellation_reason=p_cancel_reason,updated_by=p_actor where id=p_id returning * into result;
  else
   update public.association_movements set date=(p_data->>'date')::date,kind=p_data->>'kind',amount_cents=(p_data->>'amount_cents')::bigint,account=p_data->>'account',category=p_data->>'category',project=p_data->>'project',description=p_data->>'description',private_note=p_data->>'private_note',updated_by=p_actor where id=p_id returning * into result;
  end if;
 end if;
 return result;
end $$;
revoke all on function public.association_save_movement(uuid,integer,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.association_save_movement(uuid,integer,uuid,jsonb,text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('association-documents','association-documents',false,3145728,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
-- Nessuna policy Storage per anon/authenticated: download solo tramite server autorizzato.
create function public.association_save_member(p_actor uuid,p_member jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare previous jsonb; result jsonb;
begin
 select to_jsonb(m) into previous from public.association_members m where user_id=(p_member->>'user_id')::uuid for update;
 insert into public.association_members(user_id,name,email,role,active)
 values((p_member->>'user_id')::uuid,p_member->>'name',p_member->>'email',p_member->>'role',(p_member->>'active')::boolean)
 on conflict(user_id) do update set name=excluded.name,email=excluded.email,role=excluded.role,active=excluded.active;
 select to_jsonb(m) into result from public.association_members m where user_id=(p_member->>'user_id')::uuid;
 insert into public.association_audit(entity,entity_id,actor_id,action,before_data,after_data)
 values('association_members',(p_member->>'user_id')::uuid,p_actor,'permissions',previous,result);
end $$;
revoke all on function public.association_save_member(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.association_save_member(uuid,jsonb) to service_role;
revoke update,delete on public.association_audit from service_role;
revoke delete on public.association_movements,public.association_members,public.association_documents from service_role;
create function public.association_track_document() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.association_audit(entity,entity_id,actor_id,action,after_data)
 values('association_documents',new.id,new.created_by,'document',to_jsonb(new));
 return new;
end $$;
revoke all on function public.association_track_document() from public,anon,authenticated;
grant execute on function public.association_track_document() to service_role;
create trigger association_document_audit after insert on public.association_documents for each row execute function public.association_track_document();
