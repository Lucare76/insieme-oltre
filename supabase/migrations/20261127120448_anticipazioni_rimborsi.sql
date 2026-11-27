-- Separazione tra movimenti finanziari e gestione corrente. Il saldo resta per cassa.
alter table public.association_movements add column financial boolean not null default false, add column advance_managed boolean not null default false;
create table public.association_advances (
 id uuid primary key,
 kind text not null check (kind in ('deposit','expense')),
 person text not null check (length(trim(person)) between 1 and 120),
 date date not null check (date between '2000-01-01' and '2199-12-31'),
 amount_cents bigint not null check (amount_cents between 1 and 9999999999),
 category text not null check (length(trim(category)) between 1 and 100),
 project text not null default '' check (length(project)<=120),
 description text not null check (length(trim(description)) between 1 and 500),
 deposit_movement_id uuid unique references public.association_movements(id),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 check ((kind='deposit') = (deposit_movement_id is not null))
);
create table public.association_reimbursements (
 id uuid primary key,
 advance_id uuid not null references public.association_advances(id),
 date date not null check (date between '2000-01-01' and '2199-12-31'),
 amount_cents bigint not null check (amount_cents between 1 and 9999999999),
 account text not null check (account in ('cash','bank')),
 movement_id uuid not null unique references public.association_movements(id),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create index association_reimbursements_advance_idx on public.association_reimbursements(advance_id);
alter table public.association_advances enable row level security;
alter table public.association_reimbursements enable row level security;
revoke all on public.association_advances,public.association_reimbursements from public,anon,authenticated;
grant select,insert on public.association_advances,public.association_reimbursements to service_role;

-- I movimenti connessi non possono essere modificati o cancellati dal registro.
create function public.association_guard_advance_movement() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.association_advances where deposit_movement_id=old.id)
 or exists(select 1 from public.association_reimbursements where movement_id=old.id) then
  raise exception 'Movimento collegato a un’anticipazione: rettifica amministrativa necessaria.' using errcode='AR409';
 end if;
 return new;
end $$;
revoke all on function public.association_guard_advance_movement() from public,anon,authenticated;
grant execute on function public.association_guard_advance_movement() to service_role;
create trigger association_guard_advance_movement before update or delete on public.association_movements for each row execute function public.association_guard_advance_movement();

create function public.association_create_advance(p_id uuid,p_actor uuid,p_kind text,p_person text,p_date date,p_amount bigint,p_account text,p_category text,p_project text,p_description text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare m uuid; oldrow public.association_advances;
begin
 if p_id is null or p_actor is null or p_kind not in ('deposit','expense') or p_account not in ('cash','bank') then raise exception 'Dati non validi.' using errcode='AR400'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
 select * into oldrow from public.association_advances where id=p_id;
 if found then
  if oldrow.kind<>p_kind or oldrow.person<>p_person or oldrow.date<>p_date or oldrow.amount_cents<>p_amount or oldrow.category<>p_category or oldrow.project<>p_project or oldrow.description<>p_description or oldrow.created_by<>p_actor or (p_kind='deposit' and not exists(select 1 from public.association_movements where id=oldrow.deposit_movement_id and account=p_account)) then raise exception 'Richiesta già utilizzata con dati diversi.' using errcode='AR409'; end if;
  return p_id;
 end if;
 if p_kind='deposit' then
  insert into public.association_movements(date,kind,amount_cents,account,category,project,description,private_note,created_by,updated_by,financial,advance_managed)
  values(p_date,'income',p_amount,p_account,'Deposito da restituire','',p_description,'',p_actor,p_actor,true,true) returning id into m;
 end if;
 insert into public.association_advances(id,kind,person,date,amount_cents,category,project,description,deposit_movement_id,created_by)
 values(p_id,p_kind,p_person,p_date,p_amount,p_category,p_project,p_description,m,p_actor);
 return p_id;
end $$;
create function public.association_reimburse_advance(p_id uuid,p_advance uuid,p_actor uuid,p_date date,p_amount bigint,p_account text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare a public.association_advances; previous public.association_reimbursements; total bigint; m uuid;
begin
 if p_id is null or p_actor is null or p_account not in ('cash','bank') or p_amount is null or p_amount<=0 then raise exception 'Dati non validi.' using errcode='AR400'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
 select * into previous from public.association_reimbursements where id=p_id;
 if found then
  if previous.advance_id<>p_advance or previous.date<>p_date or previous.amount_cents<>p_amount or previous.account<>p_account or previous.created_by<>p_actor then raise exception 'Richiesta già utilizzata con dati diversi.' using errcode='AR409'; end if;
  return p_id;
 end if;
 select * into a from public.association_advances where id=p_advance for update;
 if not found then raise exception 'Anticipazione inesistente.' using errcode='AR404'; end if;
 if p_date<a.date then raise exception 'Il rimborso non può precedere l’anticipazione.' using errcode='AR400'; end if;
 select coalesce(sum(amount_cents),0) into total from public.association_reimbursements where advance_id=p_advance;
 if p_amount > a.amount_cents-total then raise exception 'Importo superiore al residuo da rimborsare.' using errcode='AR409'; end if;
 insert into public.association_movements(date,kind,amount_cents,account,category,project,description,private_note,created_by,updated_by,financial,advance_managed)
 values(p_date,'expense',p_amount,p_account,case when a.kind='deposit' then 'Restituzione deposito' else a.category end,case when a.kind='deposit' then '' else a.project end,'Rimborso a '||a.person||': '||left(a.description,350),'',p_actor,p_actor,a.kind='deposit',true) returning id into m;
 insert into public.association_reimbursements(id,advance_id,date,amount_cents,account,movement_id,created_by) values(p_id,p_advance,p_date,p_amount,p_account,m,p_actor);
 return p_id;
end $$;
revoke all on function public.association_create_advance(uuid,uuid,text,text,date,bigint,text,text,text,text),public.association_reimburse_advance(uuid,uuid,uuid,date,bigint,text) from public,anon,authenticated;
grant execute on function public.association_create_advance(uuid,uuid,text,text,date,bigint,text,text,text,text),public.association_reimburse_advance(uuid,uuid,uuid,date,bigint,text) to service_role;

create function public.association_track_advance() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.association_audit(entity,entity_id,actor_id,action,after_data) values(TG_TABLE_NAME,new.id,new.created_by,'create',to_jsonb(new));
 return new;
end $$;
revoke all on function public.association_track_advance() from public,anon,authenticated;
grant execute on function public.association_track_advance() to service_role;
create trigger association_advances_audit after insert on public.association_advances for each row execute function public.association_track_advance();
create trigger association_reimbursements_audit after insert on public.association_reimbursements for each row execute function public.association_track_advance();

-- Un deposito finanziario non può diventare ricevuta di donazione.
create function public.association_guard_financial_receipt() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.association_movements where id=new.movement_id and financial) then
  raise exception 'Un deposito finanziario non è una donazione.' using errcode='AR409';
 end if;
 return new;
end $$;
revoke all on function public.association_guard_financial_receipt() from public,anon,authenticated;
grant execute on function public.association_guard_financial_receipt() to service_role;
create trigger association_financial_receipt_guard before insert on public.association_receipts for each row execute function public.association_guard_financial_receipt();
