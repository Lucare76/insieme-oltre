# Ricevute nell’area soci

La sezione è disponibile dal menu **Ricevute** dell’area soci per admin e responsabile contabile. Gli altri soci continuano a consultare solo la contabilità. Non vengono creati incassi, ricevute, utenti o invii di esempio.

## Attivazione

1. Applicare `supabase/migrations/20261023142050_association_receipts.sql` al progetto corretto dopo la revisione della PR. La migration è aggiuntiva e non inserisce dati.
2. Configurare sul server `RECEIPT_ISSUER_NAME`, `RECEIPT_ISSUER_TAX_CODE` (11 cifre), `RECEIPT_ISSUER_ADDRESS` e `RECEIPT_ISSUER_REPRESENTATIVE` con i dati ufficiali verificati. Usare la denominazione effettivamente utilizzabile al momento dell’emissione.
3. Per le email vengono riutilizzate `BREVO_API_KEY` e `CONTACT_FROM_EMAIL` del sito. Il mittente deve essere autorizzato su Brevo. Non sono introdotti collegamenti o pixel di tracciamento nel messaggio.
4. Distribuire il codice e verificare l’accesso con i ruoli autorizzati. Nessuna email viene inviata automaticamente all’attivazione.

Senza i dati ufficiali dell’associazione, la nuova emissione resta disabilitata. La configurazione fiscale della raccolta fondi e il testo da utilizzare devono essere verificati dall’associazione prima dell’uso: il software non determina se l’operazione rientra in un regime agevolato. Non vengono stampate dichiarazioni di esenzione da bollo, esclusione IVA o deducibilità automatica.

## Utilizzo

1. Dopo l’effettivo incasso, registrare l’entrata in **Contabilità**. Il modulo non è un sistema per richieste di pagamento o promesse di donazione.
2. In **Ricevute → Nuova ricevuta**, selezionare l’entrata. Data e importo provengono dal movimento; il conto deve corrispondere al metodo di pagamento.
3. Scegliere **donazione libera** (nessun bene o servizio in cambio) oppure **partecipazione a raccolta fondi** (descrivere iniziativa, beni e quantità).
4. Compilare il versante, confermare i dati e scaricare l’anteprima. L’anteprima non assegna un numero e non viene archiviata come ricevuta emessa.
5. Emettere la ricevuta. La numerazione progressiva unica viene assegnata dal database; il numero è visualizzato con l’anno di emissione e **non riparte da 1 ogni anno**. Possono esserci salti tecnici; i numeri non sono riutilizzati.
6. Scaricare il PDF con il logo ufficiale. Al primo download o invio, i byte vengono conservati nel database per riutilizzare lo stesso allegato negli accessi successivi.
7. Se è stata indicata l’email, scegliere **Invia email**, riscrivere l’indirizzo e confermare. Il PDF viene allegato alla mail. L’emissione, da sola, non invia messaggi.

Le ricevute conservano i dati dell’emittente e dell’incasso al momento dell’emissione. Non sono fatture e non includono firme digitali. I caratteri non rappresentabili dal font del PDF vengono bloccati prima dell’emissione, senza sostituire silenziosamente il nome del versante.

## Correzioni e affidabilità

- Una sola ricevuta attiva per entrata. Il medesimo identificativo di richiesta restituisce la stessa emissione in caso di retry.
- Un movimento collegato a una ricevuta attiva è protetto dalle modifiche: prima annullare la ricevuta motivando l’operazione, poi correggere eventualmente il movimento ed emettere il nuovo documento.
- L’annullamento conserva il documento e lo storico; non elimina né annulla l’incasso. Il download di una ricevuta annullata è contrassegnato. Se la mail era già partita, il destinatario va informato separatamente.
- Nessun invio ripetuto dopo una conferma del provider. “Accettata da Brevo” non equivale a “consegnata”: consegna e rimbalzi si verificano nei log Brevo.
- Timeout, errori server del provider o interruzioni dopo l’invio possono lasciare lo stato `unknown` o `sending`. Il sistema blocca i retry per prevenire duplicati. Un admin tecnico deve verificare i log Brevo e riconciliare `provider_id`, `mail_status` e `sent_at`; riportare a `pending` solo se è accertato che il provider non ha preso in carico il messaggio. Non sono previsti retry automatici.
- Dati ricevute e PDF non sono accessibili ai ruoli database anonimi o autenticati; le API server verificano il ruolo ad ogni richiesta. Le modifiche sono registrate nell’audit riservato all’admin.

## Verifica locale

```bash
npx tsc --noEmit
npx eslint app/admin/ReceiptsPanel.tsx app/admin/page.tsx app/api/associazione/ricevute/route.ts lib/receipts.ts lib/receiptPdf.ts next.config.ts
npm run build
npx tsc --module commonjs --moduleResolution node --target es2022 --esModuleInterop --skipLibCheck --outDir /tmp/receipt-api-build app/api/associazione/ricevute/route.ts
NODE_PATH=$PWD/node_modules RECEIPTS_TEST_BUILD=/tmp/receipt-api-build node --test tests/receipts.test.mjs
PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node --test tests/receipts-db.test.mjs
```

I test usano dati locali isolati e risposte email simulate; non inviano email né modificano il database di produzione.
