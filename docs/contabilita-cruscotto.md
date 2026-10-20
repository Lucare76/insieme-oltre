# Contabilità: cruscotto e registro

La sezione `/admin` → Contabilità distingue due ambiti:

- Disponibilità di cassa, banca e totale: tutti gli anni e tutti i movimenti attivi.
- Riepilogo annuale: entrate, uscite, differenza, andamento mensile e spese per categoria dell'anno scelto. Saldi iniziali, trasferimenti e movimenti annullati non aumentano ricavi o spese.

I saldi derivano dalle registrazioni; non esiste sincronizzazione bancaria. Un saldo negativo invita a controllare le registrazioni. La differenza annuale o di un'iniziativa non va interpretata come disponibilità bancaria.

## Operazioni

Il registro si filtra per anno, iniziativa, conto, tipo, categoria e ricerca testuale. L'esportazione CSV comprende tutti i risultati filtrati, anche oltre le 500 righe mostrate. Un trasferimento appare nel filtro di entrambi i conti e il CSV ne esplicita provenienza e destinazione. I filtri del registro non alterano il cruscotto.

Per trasferire fondi scegliere il conto di provenienza: la destinazione è mostrata prima del salvataggio. Un'unica registrazione aggiorna entrambi i conti. Per i giustificativi usare «Salva e allega documento»: il movimento viene salvato una volta e il caricamento è un'operazione separata. Se il caricamento fallisce, riprovare «Allega documento», senza ricreare il movimento. PDF/JPG/PNG fino a 3 MB, secondo la validazione server già presente.

I soci consultano riepiloghi e registro. Gli amministratori contabili registrano movimenti e caricano documenti. Documenti e note private non sono accessibili ai soci; lo storico resta riservato all'admin principale. Non sono modificati schema, ruoli o policy.

## Verifica riproducibile

```sh
npx tsc lib/accountingReports.ts --outDir /tmp/insieme-report-tests --module commonjs --target es2022 --skipLibCheck
ACCOUNTING_REPORT_BUILD=/tmp/insieme-report-tests node --experimental-strip-types --test tests/accounting.test.mjs
npx tsc 'app/api/associazione/[...path]/route.ts' --outDir /tmp/insieme-accounting-dashboard-api --module commonjs --target es2022 --esModuleInterop --skipLibCheck
ACCOUNTING_TEST_BUILD=/tmp/insieme-accounting-dashboard-api node --test tests/accounting-api.test.mjs
npm run build
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/accounting-ui.mjs
```

Il test UI avvia la build locale sulla porta 3105 e simula le API, senza creare utenti o dati in produzione. Controlla desktop/mobile, riepiloghi, filtri, trasferimenti, allegati con errore e ripetizione, vista soci e overflow.
