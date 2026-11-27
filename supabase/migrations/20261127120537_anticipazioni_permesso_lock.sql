-- SELECT FOR UPDATE richiede UPDATE su almeno una colonna. Il ruolo di servizio
-- non è accessibile dal browser; la funzione non modifica mai il valore.
grant update (id) on public.association_advances to service_role;
