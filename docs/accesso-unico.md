# Accesso unico e richieste da approvare

Ingresso unico `/admin`, con nome utente personale e password. Il vecchio `/area-soci` reindirizza a `/admin`. Il menu è diverso per owner, amministratore contabile e socio. Le API verificano sempre i permessi sul server.

## Percorso dell’utente

1. “Richiedi accesso”: nome e cognome, email, nome utente (3–32 caratteri), presa visione dell’informativa dedicata.
2. La richiesta viene salvata come pending, senza creare un ruolo o concedere accesso. Una notifica viene inviata all’email admin (`ADMIN_ALLOWED_EMAIL`), se Brevo è disponibile. La richiesta resta nel pannello anche in caso di errore email.
3. L’owner apre “Richieste di accesso” e approva scegliendo socio o amministratore contabile, oppure rifiuta. Il ruolo owner non è assegnabile da questo flusso.
4. Dopo l’approvazione viene generato un invito Supabase, consegnato tramite Brevo. Il nuovo membro ha `activated_at = null`, quindi non può accedere finché non imposta la password.
5. Il collegamento apre `/admin/imposta-password` con token nel frammento URL. Il client rimuove il frammento dalla barra degli indirizzi; il token viene scambiato solo quando si invia la nuova password. Il server verifica l’invito/recovery, controlla l’abilitazione, imposta la password e registra l’attivazione. Infine revoca la sessione temporanea: l’utente accede normalmente con nome utente/password.

Il link non viene restituito all’owner né salvato nei log di audit. I token sono monouso e la loro scadenza dipende da Supabase Auth. Nessuna password viene inviata tramite email o scelta dall’owner.

## Gestione e recupero

- Menu owner: contabilità, sito, richieste, utenti e permessi, storico e idee delle famiglie.
- Contabile: contabilità in scrittura e documenti.
- Socio: consultazione contabile, senza note private o documenti.
- “Password dimenticata?” usa l’email e restituisce lo stesso messaggio anche per account inesistenti o disabilitati.
- Dall’elenco utenti l’owner può modificare nome utente/ruolo/stato e reinviare il link di attivazione o recupero.
- Gli utenti già esistenti mantengono `activated_at` valorizzato. Se non hanno un nome utente, l’owner lo assegna prima del nuovo login. L’account principale continua a usare `ADMIN_USERNAME` e la password già presente.

## Configurazione

Restano le variabili esistenti: `ADMIN_USERNAME`, `ADMIN_ALLOWED_EMAIL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, `CONTACT_FROM_EMAIL`. `NEXT_PUBLIC_SITE_URL` definisce il sito canonico usato nelle email; default `https://www.insiemeoltreischia.it`.

Non serve configurare SMTP Supabase: `admin/generate_link` genera il token, Brevo consegna l’email. La configurazione reale delle variabili su Vercel non è stata verificata: la connessione al team ha restituito 403. Non sono stati letti segreti di produzione né inviate email reali durante i test.

La richiesta pubblica e recupero/login hanno un limite persistente su Postgres, con hash HMAC dell’IP fornito da Vercel. Richieste duplicate ricevono una risposta neutra. L’approvazione è protetta da lock e transazione; un tentativo interrotto può essere ripreso dopo 5 minuti. Se l’email fallisce dopo l’approvazione, lo stato resta approvato e il link può essere reinviato. Gli account Auth eventualmente creati da un tentativo incompleto non ricevono permessi finché la richiesta non è finalizzata.

## Verifiche

- Test unitari/API con provider simulati: richiesta, duplicati, privacy/origine, rate limit, approvazione, ruolo non assegnabile, fallimento email, password, disattivazione e login per nome utente.
- Postgres PGlite: applicazione delle migrazioni, richieste/approvazioni atomiche, ruoli, attivazione, rate limit, username e audit.
- Browser Chromium, desktop 1366 px e mobile 390 px, con API simulate: richiesta → approvazione owner → contabilità → consultazione socio → password → redirect precedente. Nessun account o messaggio reale.
- TypeScript, ESLint mirato e build di produzione.

Comandi aggiuntivi:

```bash
npx tsc --module commonjs --moduleResolution node --target es2022 --esModuleInterop --skipLibCheck --outDir /tmp/insieme-access-tests 'app/api/accesso/[...path]/route.ts' app/api/admin/login/route.ts 'app/api/associazione/[...path]/route.ts'
ACCESS_TEST_BUILD=/tmp/insieme-access-tests node --test tests/access-api.test.mjs
PGLITE_MODULE=/tmp/insieme-accounting-validation/node_modules/@electric-sql/pglite/dist/index.js node --test tests/access-db.test.mjs
PLAYWRIGHT_MODULE=/tmp/insieme-browser-check/node_modules/playwright/index.mjs UI_START_SERVER=1 UI_BASE_URL=http://127.0.0.1:3103 node tests/access-ui.mjs
```

Prima dell’uso reale verificare consegna email e attivazione con un destinatario dell’associazione autorizzato. Non sostituire i dati di produzione con fixture di test.

Migrazione remota `association_access_approval` applicata il 20 ottobre 2026 a `bgtsasvyttpxemjpwwbn`, versione `20261020103759`. RLS e revoca dei grants pubblici verificate. Nessun account, richiesta o movimento di prova creato sul progetto remoto.

## Avvisi email e nuova interfaccia richieste

La sezione richieste usa schede separate per dati e decisione, filtri per stato, badge e aggiornamento automatico ogni minuto mentre la pagina è visibile. Il ruolo da assegnare include una spiegazione dei permessi.

Il riquadro avvisi mostra all’owner l’indirizzo effettivo configurato in `ADMIN_ALLOWED_EMAIL`. “Prova email” invia una prova soltanto a quell’indirizzo; “Invia avviso” / “Reinvia avviso” ripete la notifica di una richiesta ancora da gestire. Entrambe le API sono riservate all’owner e soggette al limite persistente dei tentativi. Nessun indirizzo destinatario può essere scelto dal browser.

Per ogni nuova richiesta resta attivo l’invio immediato. L’oggetto è “Nuova notifica: richiesta di accesso — Insieme Oltre”; l’email include una versione HTML con logo ufficiale del sito, dati della richiesta e pulsante per aprire il pannello, oltre alla versione testuale. I valori inseriti dagli utenti vengono escapati nell’HTML.

`notification_sent_at` attesta l’accettazione dell’email da parte di Brevo, non la consegna nella posta in ingresso. In caso di rifiuto del provider, la prova o il reinvio restituiscono un errore leggibile senza registrare un falso invio. Il provider message ID viene restituito solo all’owner per prova e reinvio.

Verificati 19 test API focalizzati e il percorso nel browser a 1366/390 px, compresi prova e reinvio con API simulate. Nessuna email reale inviata durante i test e nessuna migrazione necessaria per questo aggiornamento.
