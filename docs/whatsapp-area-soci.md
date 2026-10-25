# Casella WhatsApp di Insieme Oltre

Prima versione collegabile direttamente alla WhatsApp Cloud API di Meta, senza un intermediario a pagamento. L’attivazione reale richiede il numero e le credenziali dell’associazione. Non sono presenti dati dimostrativi o risposte simulate nell’applicazione.

## Funzioni

- Voce WhatsApp nel backoffice: amministratore e fino a due operatori scelti dall’amministratore. Il permesso non dipende dal ruolo contabile.
- Elenco paginato, ricerca e filtri sulle conversazioni caricate, non letti, presa in carico esclusiva, riapertura e chiusura.
- Su telefono, elenco compatto e chat a tutto schermo; bozze in memoria separate per conversazione.
- Ricezione testi e metadati di immagini, vocali, video e documenti. Download autenticato degli allegati fino a 4 MB; disponibilità subordinata alla conservazione del media da parte di Meta. I file non sono archiviati permanentemente da questa versione.
- Invio di sole risposte testuali, senza template, campagne, conversazioni iniziate dall’associazione o risposte automatiche.
- Stato di invio aggiornato dai webhook. “Accettato da Meta” è distinto da “Consegnato”.
- Aggiornamento ogni 30 secondi solo quando la casella è visibile e ha il fuoco; aggiornamento al ritorno nella finestra e pulsante manuale.
- Avvisi browser facoltativi e generici mentre la casella è aperta, dove supportati. Non sono notifiche push a browser chiuso e non sostituiscono la verifica della casella.
- Pulsante pubblico “Scrivici su WhatsApp” sulla homepage, nascosto per impostazione predefinita.

## Database e sicurezza

Applicare prima dell’attivazione la migrazione:

`supabase/migrations/20261025055615_whatsapp_inbox.sql`

La migrazione è stata generata con Supabase CLI e verificata su PostgreSQL tramite PGlite. Non modifica le tabelle contabili. Crea tre tabelle con RLS attiva, senza accesso diretto per `anon` o `authenticated`; tabelle e funzioni sono accessibili solo tramite `service_role`. Le funzioni sono `SECURITY INVOKER`, con permessi espliciti. Le route verificano sempre identità e abilitazione; soltanto l’owner può modificare gli operatori. L’amministratore conserva l’accesso senza consumare uno dei due posti.

Il webhook verifica HMAC-SHA256 sul corpo originale, filtra account WhatsApp Business e ID del numero configurati, deduplica per ID Meta e conferma la ricezione solo dopo la persistenza. Nessun contenuto dei messaggi o segreto viene scritto nei log.

La finestra di 24 ore, l’assegnazione e il budget sono ricontrollati sul server e nella transazione di prenotazione. Il destinatario deriva dalla conversazione archiviata, non da un numero arbitrario passato dal client. Le prenotazioni sono serializzate per evitare doppi invii e sforamenti concorrenti.

## Variabili server

| Variabile | Utilizzo |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Token del system user Meta con accesso al numero; mai nel browser |
| `WHATSAPP_PHONE_NUMBER_ID` | ID numerico del numero Cloud API |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | ID numerico dell’account WhatsApp Business |
| `WHATSAPP_GRAPH_VERSION` | Versione Graph API supportata dall’app, nel formato `vNN.0`; scelta esplicita, nessun valore implicito |
| `WHATSAPP_APP_SECRET` | App secret per la verifica delle firme dei webhook |
| `WHATSAPP_VERIFY_TOKEN` | Segreto casuale scelto dall’associazione per la verifica iniziale |
| `WHATSAPP_SEND_ENABLED` | `true` solo dopo il collaudo del numero; invio disattivato altrimenti |
| `WHATSAPP_MONTHLY_LIMIT` | Limite prudenziale interno: 950 di default, massimo 1000 |
| `WHATSAPP_PUBLIC_ENABLED` | `true` solo quando si vuole pubblicare il pulsante |
| `WHATSAPP_PUBLIC_NUMBER` | Numero internazionale senza +, spazi o prefisso 00, ad esempio formato 39… |

Restano necessarie le variabili Supabase già utilizzate nell’area soci. Non usare prefissi `NEXT_PUBLIC_` per token o segreti Meta. Le variabili del pulsante sono lette nella homepage statica: dopo averle cambiate occorre un nuovo deploy.

## Attivazione, quando avremo il numero

1. Acquistare un numero dedicato che possa ricevere il codice di verifica via SMS o chiamata. Usare l’account Meta dell’associazione e completare i requisiti mostrati da Meta per l’account.
2. Applicare la migrazione e configurare le variabili server in un ambiente di collaudo, mantenendo invio e pulsante pubblico disattivati. Non condividere token nelle chat o nel repository.
3. Nel prodotto WhatsApp dell’app Meta configurare il callback HTTPS `/api/whatsapp/webhook`, lo stesso verify token e la sottoscrizione al campo `messages` dell’account WABA, che include messaggi e stati di consegna.
4. Con il numero di test Meta, verificare ricezione e retry, poi autorizzare gli operatori dalla casella. Abilitare l’invio soltanto nel collaudo e verificare consegna, risposta e scadenza delle 24 ore. Il repository non invia messaggi di prova autonomamente.
5. Collegare e verificare il numero definitivo, controllare nome visualizzato e accesso del token. Verificare la ricezione prima di attivare il pulsante pubblico.
6. Aggiornare l’informativa contatti per il canale WhatsApp e definire il periodo di conservazione effettivo delle conversazioni. Questa versione non cancella automaticamente lo storico.

## Costi e contatore

La gratuità non va trattata come illimitata. Le FAQ ufficiali Meta riportano, dal 1° ottobre 2026, una quota di 1000 messaggi di servizio gratuiti al mese per numero e addebiti oltre la quota. Verificare di nuovo il listino e le condizioni dell’account al momento dell’attivazione.

Il contatore interno usa il mese civile in Europe/Rome e include invii in attesa, accettati ed esiti incerti, escludendo i fallimenti espliciti. È prudenziale, non riproduce la fatturazione Meta e non vede messaggi inviati da altri strumenti sullo stesso numero. L’aggiornamento dello stato di consegna può arrivare in ritardo. Il blocco a 950 non garantisce gratuità se il numero viene usato altrove o il periodo di fatturazione ha un fuso diverso. Numero telefonico e infrastruttura hanno costi separati.

## Invio interrotto o con esito incerto

Il client genera un UUID per ogni richiesta. Dopo la prenotazione non sono effettuati retry automatici. Timeout o risposte ambigue lasciano l’invio in stato `unknown`; una chiusura del processo può lasciarlo `sending`. Altri invii nella stessa conversazione restano bloccati. I webhook riconciliano lo stato tramite l’ID Meta e `biz_opaque_callback_data`.

Se lo stato non si risolve, l’amministratore verifica l’esito nel pannello Meta prima di qualsiasi intervento. Non cambiare lo stato a `failed` per sbloccare la chat senza aver verificato che il messaggio non sia stato inviato: si rischierebbe un duplicato. Non confondere `biz_opaque_callback_data` con una garanzia di idempotenza fornita da Meta.

## Verifiche riproducibili

- `npm run build`
- `npx eslint lib/whatsapp.ts lib/whatsappServer.ts app/admin/WhatsAppPanel.tsx app/admin/page.tsx app/components/WhatsAppCta.tsx app/api/associazione/whatsapp app/api/whatsapp`
- Compilare route e librerie con `tsc --outDir /tmp/wa-build --rootDir . --module commonjs --moduleResolution node --target es2022 --esModuleInterop --skipLibCheck lib/whatsapp.ts lib/whatsappServer.ts app/api/associazione/whatsapp/route.ts app/api/whatsapp/webhook/route.ts`, poi `WA_TEST_BUILD=/tmp/wa-build NODE_PATH=$PWD/node_modules node --test tests/whatsapp-api.test.mjs`.
- Installare PGlite in una directory esterna al progetto, poi `WA_PGLITE=/percorso/node_modules/@electric-sql/pglite/dist/index.js node --test tests/whatsapp-db.test.mjs`.
- Avviare l’app localmente, poi `WA_UI_URL=http://127.0.0.1:3101 node tests/whatsapp-ui.mjs`. Richiede Playwright e Chromium; `WA_PLAYWRIGHT` può indicare il modulo Playwright, `WA_BROWSER` un eseguibile già installato. Solo questo test intercetta le API con dati fittizi; nessun messaggio raggiunge Meta.

Il collaudo locale verifica separatamente browser, route e PostgreSQL. Il collaudo completo con Meta rimane da eseguire con numero e account dell’associazione.

## Riferimenti ufficiali

- https://whatsappbusiness.com/resources/faq/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages
- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages
- https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/text-messages
- https://supabase.com/docs/guides/database/postgres/row-level-security
