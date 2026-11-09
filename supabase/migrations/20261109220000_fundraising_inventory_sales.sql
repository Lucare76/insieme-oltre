-- Raccolte occasionali: magazzino e consegne con incasso atomico.
-- Applicare prima del deploy dell'interfaccia, mai automaticamente sulla produzione.
create table if not exists public.association_fundraising_stock (
 project text not null check (length(project) between 1 and 120),
 product text not null check (product in ('panettone','candela')),
 total_units integer not null default 0 check (total_units between 0 and 1000000),
 min_price_cents integer not null check (min_price_cents between 1 and 100000),
 updated_at timestamptz not null default now(),
 primary key (project, product)
);
create table if not exists public.association_fundraising_sales (
 id uuid primary key default gen_random_uuid(),
 project text not null,
 product text not null,
 quantity integer not null check (quantity between 1 and 10000),
 amount_cents bigint not null check (amount_cents > 0),
 volunteer text not null check (length(volunteer) between 1 and 120),
 sale_date date not null,
 account text not null check (account in ('cash','bank')),
 movement_id uuid not null unique references public.association_movements(id),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 cancelled_at timestamptz,
 cancelled_by uuid references auth.users(id),
 constraint fundraising_stock_ref foreign key (project,product)
 references public.association_fundraising_stock(project,product)
);
create index if not exists fundraising_sales_project_idx on public.association_fundraising_sales (project, product, sale_date);
alter table public.association_fundraising_stock enable row level security;
alter table public.association_fundraising_sales enable row level security;
revoke all on public.association_fundraising_stock from anon, authenticated;
revoke all on public.association_fundraising_sales from anon, authenticated;

-- Richiamate solo dal backend server con service role, con autorizzazione utente già verificata.
create or replace function public.association_fundraising_stock_set(
 p_project text, p_product text, p_units integer, p_actor uuid
) returns void language plpgsql set search_path = '' as $$
declare used_units bigint;
begin
 if p_project is null or length(trim(p_project)) not between 1 and 120
 or p_product not in ('panettone','candela')
 or p_units is null or p_units not between 0 and 1000000 then
  raise exception 'stock non valido';
 end if;
 if not exists (select 1 from auth.users where id=p_actor) then raise exception 'utente non valido'; end if;
 insert into public.association_fundraising_stock(project,product,total_units,min_price_cents)
 values(trim(p_project),p_product,0,case when p_product='panettone' then 2000 else 500 end)
 on conflict (project,product) do nothing;
 perform 1 from public.association_fundraising_stock where project=trim(p_project) and product=p_product for update;
 select coalesce(sum(quantity),0) into used_units from public.association_fundraising_sales
 where project=trim(p_project) and product=p_product and cancelled_at is null;
 if p_units < used_units then raise exception 'stock inferiore ai prodotti gia consegnati'; end if;
 update public.association_fundraising_stock set total_units=p_units, updated_at=now()
 where project=trim(p_project) and product=p_product;
end $$;
create or replace function public.association_fundraising_sell(
 p_project text, p_product text, p_quantity integer, p_amount bigint,
 p_volunteer text, p_date date, p_account text, p_actor uuid
) returns uuid language plpgsql set search_path = '' as $$
declare s public.association_fundraising_stock; sold bigint; m_id uuid; sale_id uuid;
begin
 if p_project is null or length(trim(p_project)) not between 1 and 120
 or p_product not in ('panettone','candela')
 or p_quantity is null or p_quantity not between 1 and 10000
 or p_amount is null or p_amount <= 0 or p_amount > 9999999999
 or p_volunteer is null or length(trim(p_volunteer)) not between 1 and 120
 or p_account not in ('cash','bank')
 or p_date is null or p_date not between date '2000-01-01' and date '2199-12-31'
 then raise exception 'dati consegna non validi'; end if;
 if not exists (select 1 from auth.users where id=p_actor) then raise exception 'utente non valido'; end if;
 select * into s from public.association_fundraising_stock
 where project=trim(p_project) and product=p_product for update;
 if not found then raise exception 'impostare prima la disponibilita'; end if;
 if p_amount < p_quantity::bigint * s.min_price_cents then raise exception 'importo inferiore al contributo minimo'; end if;
 select coalesce(sum(quantity),0) into sold from public.association_fundraising_sales
 where project=s.project and product=s.product and cancelled_at is null;
 if sold + p_quantity > s.total_units then raise exception 'disponibilita insufficiente'; end if;
 insert into public.association_movements(date,kind,amount_cents,account,category,project,description,private_note,created_by,updated_by)
 values(p_date,'income',p_amount,p_account,'Raccolta fondi',s.project,
   'Contributi per '||p_quantity::text||' '||case when p_product='panettone' then 'panettoni solidali' else 'candele solidali' end,
   'Volontario: '||trim(p_volunteer),p_actor,p_actor)
 returning id into m_id;
 insert into public.association_fundraising_sales(project,product,quantity,amount_cents,volunteer,sale_date,account,movement_id,created_by)
 values(s.project,s.product,p_quantity,p_amount,trim(p_volunteer),p_date,p_account,m_id,p_actor)
 returning id into sale_id;
 return sale_id;
end $$;
create or replace function public.association_fundraising_cancel(
 p_id uuid,p_actor uuid,p_reason text
) returns void language plpgsql set search_path = '' as $$
declare s public.association_fundraising_sales;
begin
 if p_reason is null or length(trim(p_reason)) not between 10 and 500 then raise exception 'motivazione obbligatoria'; end if;
 select * into s from public.association_fundraising_sales where id=p_id for update;
 if not found or s.cancelled_at is not null then raise exception 'consegna gia annullata o inesistente'; end if;
 perform 1 from public.association_fundraising_stock where project=s.project and product=s.product for update;
 update public.association_movements
 set cancelled=true,cancellation_reason=trim(p_reason),updated_by=p_actor
 where id=s.movement_id and cancelled=false;
 if not found then raise exception 'movimento non annullabile'; end if;
 update public.association_fundraising_sales set cancelled_at=now(), cancelled_by=p_actor where id=s.id;
end $$;
-- Vietare rettifiche generiche ai movimenti legati a una consegna; usare annullamento dedicato.
create or replace function public.association_fundraising_guard_movement()
 returns trigger language plpgsql set search_path = '' as $$
begin
 if exists(select 1 from public.association_fundraising_sales where movement_id=old.id)
 and (new.cancelled is distinct from old.cancelled or new.amount_cents is distinct from old.amount_cents
 or new.project is distinct from old.project or new.kind is distinct from old.kind
 or new.description is distinct from old.description or new.account is distinct from old.account)
 and not (new.cancelled=true and old.cancelled=false and exists
 (select 1 from public.association_fundraising_sales where movement_id=old.id and cancelled_at is null)
 and current_setting('app.fundraising_cancel',true)='yes')
 then raise exception 'gestire le consegne dalla sezione raccolte fondi';
 end if;
 return new;
end $$;
drop trigger if exists association_fundraising_guard on public.association_movements;
create trigger association_fundraising_guard before update on public.association_movements
for each row execute function public.association_fundraising_guard_movement();
-- La funzione di annullamento abilita la modifica contabile solo nella stessa transazione.
create or replace function public.association_fundraising_cancel(
 p_id uuid,p_actor uuid,p_reason text
) returns void language plpgsql set search_path = '' as $$
declare s public.association_fundraising_sales;
begin
 if p_reason is null or length(trim(p_reason)) not between 10 and 500 then raise exception 'motivazione obbligatoria'; end if;
 select * into s from public.association_fundraising_sales where id=p_id for update;
 if not found or s.cancelled_at is not null then raise exception 'consegna gia annullata o inesistente'; end if;
 perform 1 from public.association_fundraising_stock where project=s.project and product=s.product for update;
 perform set_config('app.fundraising_cancel','yes',true);
 update public.association_movements set cancelled=true,cancellation_reason=trim(p_reason),updated_by=p_actor
 where id=s.movement_id and cancelled=false;
 if not found then raise exception 'movimento non annullabile'; end if;
 update public.association_fundraising_sales set cancelled_at=now(),cancelled_by=p_actor where id=s.id;
 perform set_config('app.fundraising_cancel','',true);
end $$;
revoke all on function public.association_fundraising_stock_set(text,text,integer,uuid) from public,anon,authenticated;
revoke all on function public.association_fundraising_sell(text,text,integer,bigint,text,date,text,uuid) from public,anon,authenticated;
revoke all on function public.association_fundraising_cancel(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.association_fundraising_stock_set(text,text,integer,uuid) to service_role;
grant execute on function public.association_fundraising_sell(text,text,integer,bigint,text,date,text,uuid) to service_role;
grant execute on function public.association_fundraising_cancel(uuid,uuid,text) to service_role;
