-- Promemoria rinnovo quote: opt-in amministrativo per ciascun anno.
create table public.association_fee_reminder_settings (
 fee_year integer primary key check (fee_year between 2020 and 2199),
 due_on date not null,
 enabled boolean not null default false,
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 constraint association_fee_reminder_due_year check (extract(year from due_on)::integer = fee_year)
);
create table public.association_fee_reminder_deliveries (
 id uuid primary key default gen_random_uuid(),
 fee_year integer not null references public.association_fee_reminder_settings(fee_year),
 person_id uuid not null references public.association_register_people(id),
 recipient_email text not null,
 status text not null default 'sending' check (status in ('sending','sent','failed')),
 provider_message_id text,
 attempted_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(fee_year,person_id)
);
create index association_fee_reminder_deliveries_year on public.association_fee_reminder_deliveries(fee_year,status);
alter table public.association_fee_reminder_settings enable row level security;
alter table public.association_fee_reminder_deliveries enable row level security;
revoke all on public.association_fee_reminder_settings,public.association_fee_reminder_deliveries from public,anon,authenticated;
grant select,insert,update on public.association_fee_reminder_settings,public.association_fee_reminder_deliveries to service_role;
revoke delete on public.association_fee_reminder_settings,public.association_fee_reminder_deliveries from service_role;
