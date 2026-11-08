-- Gli inviti predisposti dall'amministratore NON devono simulare
-- un'accettazione dell'informativa da parte della persona invitata.
-- La privacy si conferma dall'interessato quando imposta la password.
alter table public.association_access_requests
  add column if not exists created_by_admin uuid references auth.users(id);
alter table public.association_access_requests
  alter column privacy_at drop not null;

alter table public.association_access_requests
  add constraint association_request_consent_origin_check
  check (
    (created_by_admin is null and privacy_at is not null)
    or (created_by_admin is not null)
  );

-- Non cambia RLS, grants, status o modalità di approvazione:
-- gli inviti creati dall'admin restano pending prima di un invio.
