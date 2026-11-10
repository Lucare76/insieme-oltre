-- Il backend identifica l'operatore prima di chiamare le RPC.
-- Evita una lettura diretta di auth.users non concessa a service_role.
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
 if p_actor is null then raise exception 'utente non valido'; end if;
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
 if p_actor is null then raise exception 'utente non valido'; end if;
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
