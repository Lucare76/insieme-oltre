-- Optional planning questions. Existing survey responses keep null/empty values.
-- Apply after 20261015160000_participation_submissions.sql.
alter table if exists public.participation_submissions
  add column if not exists need text check (
    need is null or need in ('servizi','attivita','autonomia','relazioni','futuro')
  ),
  add column if not exists times text[] not null default '{}'::text[] check (
    cardinality(times) <= 2
    and times <@ array['mattina','pomeriggio','sera','weekend']::text[]
  ),
  add column if not exists obstacle text check (
    obstacle is null or obstacle in ('trasporti','orari','costi','accessibilita','nessuno')
  ),
  add column if not exists contribution text check (
    contribution is null or contribution in ('volontario','competenze','saltuario','partecipante','incerto')
  );
