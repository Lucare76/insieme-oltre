-- Le candidature non costituiscono iscrizione all'ODV né al registro ufficiale volontari.
create table public.association_volunteer_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  email text not null check (length(email) between 3 and 254),
  phone text not null default '' check (length(phone) <= 40),
  status text not null default 'new' check (status in ('new','contacted','available','active','closed')),
  availability text not null default '' check (length(availability) <= 500),
  notes text not null default '' check (length(notes) <= 1000),
  source text not null default 'site' check (source in ('site','manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index association_volunteer_applications_email_idx
  on public.association_volunteer_applications (lower(email));
create index association_volunteer_applications_recent_idx
  on public.association_volunteer_applications (created_at desc);
alter table public.association_volunteer_applications enable row level security;
revoke all on public.association_volunteer_applications from public,anon,authenticated;
grant select,insert,update,delete on public.association_volunteer_applications to service_role;
