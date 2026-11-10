-- L'API /api/associazione/fundraising usa il service_role sul server.
-- Le tabelle restano protette da RLS; nessun permesso diretto a utenti anonimi/autenticati.
grant select, insert, update on table public.association_fundraising_stock to service_role;
grant select, insert, update on table public.association_fundraising_sales to service_role;
revoke all on table public.association_fundraising_stock from anon, authenticated;
revoke all on table public.association_fundraising_sales from anon, authenticated;
