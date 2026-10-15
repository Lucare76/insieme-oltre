-- Risposte al questionario, separate dai testi pubblici del sito.
-- Solo il backend autorizzato con service_role può leggere o scrivere.
create table if not exists public.participation_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role text not null check (role in ('familiare','persona','volontario')),
  age text not null check (age in ('infanzia','giovani','adulti','tutte')),
  interests text[] not null check (cardinality(interests) between 1 and 3),
  idea text check (length(idea) <= 350),
  constraint valid_interests check (interests <@ array['famiglie','laboratori','autonomia','sport','lavoro','digitale']::text[])
);
create index if not exists participation_submissions_created_at_idx
  on public.participation_submissions (created_at desc);
alter table public.participation_submissions enable row level security;
revoke all on table public.participation_submissions from public, anon, authenticated;
grant select, insert on table public.participation_submissions to service_role;
comment on table public.participation_submissions is 'Priorità attività Insieme Oltre: nessun nominativo, recapito o indirizzo IP salvato.';
