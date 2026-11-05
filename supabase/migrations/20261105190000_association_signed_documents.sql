-- Archivio riservato di versioni PDF definitive e copie firmate con dispositivi esterni (es. Aruba Sign).
-- Le impronte SHA-256 garantiscono controllo di integrità dei byte archiviati,
-- NON attestano validità, identità o certificazione della firma elettronica.
create table public.association_signed_documents (
 id uuid primary key default gen_random_uuid(),
 kind text not null check (kind in ('soci','volontari','assemblee','direttivo')),
 stage text not null check(stage in ('original','signed')),
 source_id uuid references public.association_signed_documents(id),
 object_path text not null unique,
 filename text not null check(length(filename) between 1 and 180),
 sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
 file_bytes integer not null check (file_bytes between 1 and 8388608),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 constraint association_signature_stage check(
  (stage='original' and source_id is null) or
  (stage='signed' and source_id is not null)
 )
);
create unique index association_signed_documents_one_signed
 on public.association_signed_documents(source_id) where stage='signed';
create index association_signed_documents_recent
 on public.association_signed_documents(kind, created_at desc, id desc);
alter table public.association_signed_documents enable row level security;
revoke all on public.association_signed_documents from public, anon, authenticated;
grant select,insert on public.association_signed_documents to service_role;
-- Nessun UPDATE/DELETE: documenti e impronte sono append-only.
revoke update,delete on public.association_signed_documents from service_role;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 values ('association-signed-documents','association-signed-documents',false,8388608,array['application/pdf'])
 on conflict (id) do nothing;
-- Non creare policy pubbliche sul bucket: si accede solo dalle API server autorizzate.
