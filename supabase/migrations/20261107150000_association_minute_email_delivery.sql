-- Rubrica esplicita per comunicazioni ai soci: gli account dell'area riservata NON costituiscono il libro soci.
create table public.association_member_delivery_contacts (
 person_id uuid primary key references public.association_register_people(id) on delete restrict,
 email text not null check (length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table public.association_member_delivery_contacts enable row level security;
revoke all on public.association_member_delivery_contacts from public,anon,authenticated;
grant select,insert,update on public.association_member_delivery_contacts to service_role;
-- Registro persistente degli invii, un invio per socio e verbale per evitare duplicati accidentali.
create table public.association_minute_email_deliveries (
 id uuid primary key default gen_random_uuid(),
 minute_id uuid not null references public.association_register_minutes(id) on delete restrict,
 person_id uuid not null references public.association_register_people(id) on delete restrict,
 recipient_email text not null,
 status text not null default 'sending' check (status in ('sending','sent','failed')),
 message_id text,
 error_message text,
 requested_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(minute_id,person_id)
);
create index association_minute_email_deliveries_by_minute on public.association_minute_email_deliveries(minute_id,created_at);
alter table public.association_minute_email_deliveries enable row level security;
revoke all on public.association_minute_email_deliveries from public,anon,authenticated;
grant select,insert,update on public.association_minute_email_deliveries to service_role;
