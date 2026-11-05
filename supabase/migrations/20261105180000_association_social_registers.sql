-- Registri sociali separati dagli account di accesso all'area soci.
-- Nessuna migration va eseguita sulla produzione prima di approvare la PR.
create table public.association_register_people (
 id uuid primary key default gen_random_uuid(),
 register_kind text not null check (register_kind in ('soci','volontari')),
 full_name text not null check (length(trim(full_name)) between 2 and 160),
 birth_date date, fiscal_code text not null default '' check (length(fiscal_code)<=24),
 admitted_on date not null,
 ended_on date,
 notes text not null default '' check (length(notes)<=500),
 insurance_reference text not null default '' check (length(insurance_reference)<=160),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 constraint association_register_dates check (ended_on is null or ended_on >= admitted_on)
);
create table public.association_register_minutes (
 id uuid primary key default gen_random_uuid(),
 meeting_kind text not null check (meeting_kind in ('assemblee','direttivo')),
 meeting_on date not null,
 title text not null check (length(trim(title)) between 2 and 200),
 attendees text not null check (length(trim(attendees)) between 2 and 4000),
 content text not null check (length(trim(content)) between 2 and 20000),
 approved boolean not null default false,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index association_register_people_sort on public.association_register_people(register_kind,admitted_on,id);
create index association_register_minutes_sort on public.association_register_minutes(meeting_kind,meeting_on,id);
alter table public.association_register_people enable row level security;
alter table public.association_register_minutes enable row level security;
revoke all on public.association_register_people,public.association_register_minutes from public,anon,authenticated;
grant select,insert on public.association_register_people,public.association_register_minutes to service_role;
-- Append-only per la prima versione: nessuna cancellazione silenziosa di atti o iscrizioni.
revoke update,delete on public.association_register_people,public.association_register_minutes from service_role;
