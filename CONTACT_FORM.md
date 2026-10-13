# Form «Parla con noi»

Il CTA usa l'ancora #unisciti e lo scroll morbido già presente. Il form è integrato nella homepage, senza modal. MusicExperience, storie, admin/auth e metadata non sono modificati.

## Attivazione

Al momento l'invio è bloccato: `lib/legal.ts` dichiara la Privacy Policy non pubblicata e `/privacy-policy` non esiste. Il checkbox e il pulsante sono disabilitati; anche il POST valido riceve 503 e non contatta Brevo. Non cambiare il flag prima di pubblicare la pagina con i dati reali e l'informativa relativa al form e al fornitore email.

Variabili esclusivamente server-side:

- `BREVO_API_KEY`: chiave API Brevo reale (non chiave SMTP).
- `CONTACT_FROM_EMAIL`: mittente verificato in Brevo.
- `CONTACT_TO_EMAIL`: facoltativa; predefinita `info@insiemeoltreischia.it`.

Nessuna variabile deve avere il prefisso NEXT_PUBLIC. Nessuna credenziale è inclusa nel repository. Configurare le variabili e rifare il deploy dopo la pubblicazione della Privacy Policy. Verificare anche che la casella destinataria riceva davvero email.

## Flusso

Validazione HTML → POST JSON /api/contact → controllo origine, quota e dimensione (24 KB) → honeypot → validazione server → controllo Privacy Policy → Brevo → feedback. Il mittente è fisso; Reply-To è l'email del visitatore. Il corpo è testo semplice; non si inserisce HTML dell'utente. Nessun salvataggio su database né email automatica al visitatore. Il provider viene atteso prima del successo; in caso di errore i campi rimangono compilati. Un esito positivo indica accettazione del provider, non conferma di consegna nella casella.

## Protezioni e limiti

- Honeypot nascosto e fuori dal percorso tastiera; compilato restituisce una risposta neutra senza invio.
- Campi obbligatori, checkbox booleano true, ruoli in whitelist; limiti nome 120, email 254, telefono 40, messaggio 5000 caratteri.
- Cinque richieste ogni 15 minuti, in memoria per istanza. Su Vercel usa x-vercel-forwarded-for; IP salvato solo come hash. In locale/IP ignoto usa un bucket comune. Scadenza e limite massimo di 10.000 bucket.
- Il limite non è distribuito, si azzera al cold start e non garantisce una quota globale su serverless.
- Timeout provider 10 secondi; nessun log di messaggi o credenziali, nessun retry automatico per evitare duplicazioni dopo timeout.

## Verifica prima dell'attivazione

Con provider simulato verificare successo, errore e timeout; dopo configurazione reale e pubblicazione privacy effettuare un unico invio concordato, controllando ricezione e Reply-To. Nessuna email reale è stata inviata durante lo sviluppo.

## Test locali riproducibili

```sh
npx tsc app/api/contact/route.ts --outDir ../contact-test-build --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck
CONTACT_TEST_BUILD="$(cd ../contact-test-build && pwd)" node --test tests/contact.test.mjs
```

I test usano chiavi segnaposto e fetch simulato. L'attivazione del flag privacy avviene solo nel modulo compilato temporaneo del processo di test: `lib/legal.ts` resta invariato.

## Esito verifica

- `npx tsc --noEmit`: superato.
- `npm run lint`: zero errori; un warning preesistente in `app/opengraph-image.tsx` (direttiva eslint-disable inutilizzata), file non modificato.
- `npm run build`: superato; route `/api/contact` dinamica.
- Test backend: 8/8 superati, provider completamente simulato.
- Browser Chromium su build produzione: CTA verso #unisciti, titolo, campi obbligatori, blocco Privacy e assenza di errori JavaScript verificati. Larghezza documento uguale al viewport a 360, 390 e 1440 px; nessun overflow orizzontale. Form mobile controllato anche visivamente.
- Nessun commit, push o invio email reale.
