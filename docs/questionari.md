# Questionari degli incontri e ruoli cumulativi

Area riservata `/admin/questionari`, compilazione pubblica `/q/<token>`. Stesso accesso unico di `/admin`: per richieste, approvazione e password vedere `docs/accesso-unico.md`.

## Ruoli

Ogni utente ha un ruolo economico e, in aggiunta, l’abilitazione ai questionari. I ruoli sono cumulabili (es. Psicologa + Socio).

- Super admin: account `ADMIN_ALLOWED_EMAIL`, accesso completo, vede tutti i questionari. Resta non assegnabile dall’interfaccia (scelta di sicurezza già esistente).
- Amministratore contabile (`accountant`), Socio (`member`): invariati. Il socio resta in sola lettura: API e database rifiutano ogni scrittura.
- Nessun accesso contabile (`none`): consentito solo insieme a Psicologa (vincolo `association_members_some_permission`).
- Psicologa (`psychologist = true`): solo questionari. Con il solo ruolo Psicologa, dopo il login si viene portati direttamente a `/admin/questionari`; contabilità, ricevute, WhatsApp, utenti e storico rispondono 403 anche alle chiamate API dirette.

Ogni professionista vede e gestisce solo i questionari creati da lei (stesso 404 per inesistente e non autorizzato). L’owner li vede tutti. I permessi sono riletti dal database a ogni richiesta.

Assegnazione: in “Richieste di accesso” (approvazione) e in “Utenti e permessi” (modifica/revoca), con la casella “Psicologa — gestione dei questionari”.

## Ciclo di vita

Bozza → Pubblicato → Chiuso → Archiviato, con riapertura e ripristino. La pubblicazione crea la prima sessione con link e QR code. Ogni sessione (un incontro) ha link, QR e risultati propri; il questionario si riusa creando nuove sessioni.

Le domande si modificano solo in bozza. Un questionario pubblicato senza compilazioni può tornare in bozza; con compilazioni no (blocco nel database): si usa “Duplica”. Titolo, descrizione e conservazione restano modificabili. Le risposte non vengono mai alterate.

Si accettano risposte solo se il questionario è pubblicato e la sessione aperta, verificato nella stessa transazione dell’invio.

## Compilazione

Nessun login, nome o email. Validazione completa nella funzione `qs_submit` (obbligatorie, opzioni appartenenti alla domanda, scelta singola), salvataggio atomico di compilazione e risposte, numerazione progressiva per sessione sotto lock di riga. `client_key` casuale rende idempotente un invio ripetuto.

Risposte libere in colonne `text`, nessun `maxLength`, textarea che cresce con il testo. Limite tecnico complessivo della richiesta: 4 MB (piattaforma Vercel ~4,5 MB), circa 4 milioni di caratteri.

Bozza locale in `localStorage` per 24 ore, cancellata all’invio o con “Ricomincia da capo”. La bozza non contiene identificativi.

Anti-abuso: campo nascosto, controllo origine, limite di 200 invii ogni 15 minuti per hash HMAC dell’IP (non salvato in chiaro, eliminato dopo un giorno). Il limite è alto perché molti partecipanti possono condividere il Wi-Fi della sala.

## Privacy

Non vengono salvati IP, user agent o account con le risposte; l’orario è arrotondato al minuto. Il numero “Questionario anonimo 001” è un riferimento di consultazione per sessione. Informativa contestuale nella pagina, con consenso esplicito, senza promettere anonimato assoluto per i testi liberi.

Conservazione configurabile per questionario (3/6/12/24 mesi o fino a cancellazione manuale): `qs_purge_expired()` cancella le compilazioni scadute a ogni apertura della dashboard. Per una cancellazione anche senza accessi, pianificare la funzione con `pg_cron`. Cancellazione manuale dei risultati di una sessione con conferma del nome. Testo dell’informativa e periodi vanno validati dall’associazione.

## Risultati

Schede individuali paginate (25 per pagina), precedente/successiva, testo integrale. Statistiche per sessione con conteggi e percentuali, aggiornamento automatico ogni 20 secondi a sessione aperta. Esportazioni: CSV con BOM (una riga per compilazione, una colonna per domanda, protezione da formula injection) e PDF (tutte le schede, una per pagina, o la singola scheda). Le emoji non presenti nel font del PDF sono sostituite da □ con nota; il CSV conserva il testo originale.

## Migrazione

File: `supabase/migrations/20261103100000_questionnaires_rbac.sql`. Non applicata ad alcun database remoto.

1. Provare prima su un progetto o branch Supabase di test.
2. Applicare con `supabase db push` o dall’SQL editor, dopo un backup.
3. Verificare: RLS attiva sulle sei tabelle `qs_*`, nessun grant ad `anon`/`authenticated`, funzioni eseguibili solo da `service_role`; controllare gli advisors.
4. Pubblicare il codice solo dopo la migrazione: il nuovo codice legge la colonna `psychologist`, senza la quale il login non funziona.

Nessuna nuova variabile d’ambiente. Nuova dipendenza: `qrcode` (MIT); il QR è generato nel browser senza servizi esterni.

## Verifiche

```bash
# Postgres reale in memoria (PGlite): ruoli, RLS, transizioni, invii, statistiche, conservazione
PGLITE_MODULE=file:///…/@electric-sql/pglite/dist/index.js node --test tests/questionnaires-db.test.mjs
# API con fetch simulato
npx tsc --module commonjs --moduleResolution node --target es2022 --esModuleInterop --skipLibCheck --outDir /tmp/qs-build 'app/api/questionari/[...path]/route.ts' 'app/api/q/[token]/route.ts' 'app/api/associazione/[...path]/route.ts' app/api/associazione/ricevute/route.ts
QS_TEST_BUILD=/tmp/qs-build NODE_PATH=$PWD/node_modules node --test tests/questionnaires-api.test.mjs
# Browser (Chromium desktop e iPhone 13) su build dedicata .next-e2e e finto Supabase con le vere funzioni SQL
PGLITE_MODULE=… PLAYWRIGHT_MODULE=file:///…/playwright/index.mjs SHOT_DIR=/tmp/qs-shots node tests/questionnaires-e2e.mjs
```

Il test end-to-end compila una build separata con sole variabili di test: le variabili `NEXT_PUBLIC_*` sono incorporate alla build, quindi non va eseguito su una `.next` costruita con `.env.local`.

Limiti: PGlite usa una sola connessione, quindi gli invii simultanei vengono serializzati; la correttezza sotto concorrenza reale si basa sul lock di riga della sessione. Il PDF di centinaia di schede molto lunghe richiede alcuni secondi.
