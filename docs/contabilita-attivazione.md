# Contabilità e area soci

Percorso: `/area-soci`; link dal footer pubblico e dal pannello `/admin`.

## Ruoli

- Admin principale: account già autorizzato da `ADMIN_ALLOWED_EMAIL`, riconosciuto lato server dopo verifica su Supabase Auth. Non serve inserirlo nella tabella dei soci.
- Amministratore contabile (`accountant`): consulta e registra, corregge e annulla movimenti, allega e scarica documenti. Non accede alle API di gestione sito, ai permessi o all'audit completo.
- Socio (`member`): consulta registro e riepiloghi ed esporta le sole informazioni pubblicate ai soci. Nessuna scrittura, note riservate o documenti.

I permessi vengono riletti dal database a ogni richiesta. Disattivare un socio blocca la richiesta successiva anche se il token Auth è ancora valido. Le API amministrative esistenti continuano ad accettare esclusivamente l'account principale.

## Attivazione

1. Progetto confermato dall’utente: `bgtsasvyttpxemjpwwbn` (`insieme-oltre`). Accesso verificato il 20 ottobre 2026.
2. Migrazione `association_accounting` applicata sul progetto corretto il 20 ottobre 2026, versione remota `20261020095949`. Il file locale è allineato alla versione remota. Le nuove tabelle sono chiuse ad `anon` e `authenticated`; accesso solo dalle API server. Il bucket documenti è privato.
3. Il deployment usa le variabili già previste: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_ALLOWED_EMAIL`. La chiave service role resta esclusivamente sul server.
4. Accedere come admin da `/admin`, quindi aprire “Contabilità e area soci”. In alternativa accedere con email e password da `/area-soci`.
5. In “Utenti e permessi” creare gli account con password iniziale di almeno 12 caratteri. Nessuna email inviata automaticamente. Comunicare le credenziali al destinatario personalmente. Per una password dimenticata, l'admin imposta una nuova password nello stesso pannello.
6. Provare con un account per ciascun ruolo: consultazione soci, registrazione contabile, gestione utenti solo owner. Controllare che le API e Storage non espongano documenti o note usando direttamente la chiave pubblica.
7. Inserire i saldi iniziali di banca e cassa prima dei movimenti reali. La disponibilità totale comprende i saldi iniziali; entrate/uscite e risultati per iniziativa li escludono. Un trasferimento sposta denaro da un conto all'altro senza diventare entrata o uscita.

## Registro

Importi in centesimi interi, data contabile senza fuso orario, importo positivo e tipo separato. Categoria, iniziativa, causale visibile ai soci e nota riservata. Evitare dati personali nella causale condivisa. I filtri modificano i totali di entrata/uscita; i saldi in alto restano complessivi. Il CSV contiene tutti i movimenti filtrati, anche oltre le prime 500 righe visualizzate. Caricamento API paginato senza limite di 1000 movimenti.

Le correzioni richiedono la versione corrente: due modifiche concorrenti non si sovrascrivono. L'annullamento richiede una motivazione di 10–500 caratteri. Nessuna eliminazione definitiva dall'interfaccia. Audit di movimenti, documenti e modifiche ai permessi, scritto nella stessa transazione e consultabile solo dall'owner.

Allegati PDF, JPG o PNG fino a 3 MB, riconoscimento del formato tramite firma iniziale e confronto MIME. Il download richiede autorizzazione server ed è sempre un allegato con cache disabilitata. I file non hanno URL pubblici.

Sessioni dell'area soci in sessionStorage, chiusura dopo 60 minuti di inattività o 8 ore complessive, rinnovo token con verifica del ruolo. Logout tramite Supabase Auth. Gli account possono essere disattivati individualmente.

## Verifica eseguita

- TypeScript e build di produzione.
- ESLint sui file modificati; lint generale presenta errori preesistenti in altre pagine.
- `node --test tests/accounting.test.mjs`: importi, date, saldi, trasferimenti, annullamenti e formula injection CSV.
- Test API con fetch simulato: autenticazione, separazione dei ruoli, revoca immediata, privacy delle note, paginazione e validazione server.
- Migrazione eseguita su Postgres locale tramite PGlite con ruoli anon/authenticated/service_role: grants, audit atomico, conflitti di versione, annullamento, divieto di cancellazione e gestione permessi.

Comandi riproducibili (Node 24):

```bash
node --test tests/accounting.test.mjs
npx tsc --module commonjs --moduleResolution node --target es2022 --esModuleInterop --skipLibCheck --outDir /tmp/insieme-api-tests 'app/api/associazione/[...path]/route.ts'
ACCOUNTING_TEST_BUILD=/tmp/insieme-api-tests node --test tests/accounting-api.test.mjs
# Installare PGlite in una directory temporanea e indicare il modulo:
PGLITE_MODULE=/tmp/insieme-accounting-validation/node_modules/@electric-sql/pglite/dist/index.js node --test tests/accounting-db.test.mjs
```

## Limiti da verificare prima dell'uso reale

Migrazione remota applicata e verificata: RLS attiva sulle quattro tabelle, nessun accesso diretto anon/authenticated, funzioni eseguibili solo dal server e bucket privato senza policy pubbliche. Test Auth/Storage reali e verifica visuale in browser non completati: il download del browser di test non era disponibile nell'ambiente. Sono necessari sul deployment con il progetto corretto. Non sono stati creati movimenti contabili o account di prova nel database remoto.

Questo modulo tiene il registro operativo: non genera rendiconti ministeriali, ricevute fiscali o dichiarazioni. Non comprende riconciliazione bancaria automatica o gestione delle quote annuali dovute dai singoli soci.

Controllo advisors: le segnalazioni informative RLS senza policy sono intenzionali per le tabelle accessibili solo dal server. Segnalazioni preesistenti non modificate: funzione `rls_auto_enable` e protezione password compromesse disabilitata.
