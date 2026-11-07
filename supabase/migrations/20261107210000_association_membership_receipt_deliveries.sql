-- Invio ricevute quote associative: lo stato di trasmissione è separato dall'incasso.
-- Un solo tentativo per quota, senza duplicazioni anche in caso di richieste simultanee.
create table public.association_membership_receipt_deliveries (
 id uuid primary key default gen_random_uuid(),
 fee_id uuid not null unique references public.association_membership_fees(id) on delete restrict,
 person_id uuid not null references public.association_register_people(id) on delete restrict,
 recipient_email text not null check (length(recipient_email)<=254 and recipient_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 status text not null default 'sending' check (status in ('sending','sent','failed','unknown')),
 provider_message_id text,
 error_message text,
 requested_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 completed_at timestamptz
);
create index association_membership_receipt_deliveries_person on public.association_membership_receipt_deliveries(person_id,created_at);
alter table public.association_membership_receipt_deliveries enable row level security;
revoke all on public.association_membership_receipt_deliveries from public,anon,authenticated;
grant select,insert,update on public.association_membership_receipt_deliveries to service_role;
revoke delete on public.association_membership_receipt_deliveries from service_role;
