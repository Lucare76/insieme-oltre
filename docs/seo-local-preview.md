# SEO locale — prima preview

Base: main `7ad3bc51b67203d7a0a6775132ab3c8976d6d758`.

## Cosa vedere

- `/`: slogan e hero invariati; titolo SEO e description più espliciti su sindrome di Down, trisomia 21 e Ischia. Nuova frase nella sezione Chi siamo, collegamenti alla nuova pagina da menu, manifesto e footer.
- `/chi-siamo`: pagina editoriale con missione, origine, territorio, quattro direzioni progettuali e inviti a conoscere le storie, condividere idee o contattare l'associazione. Nessuna attività presentata come già operativa. Logo originale riutilizzato, senza modifiche al file.
- `/storie/aurora`: titolo SEO descrittivo, senza modifiche al titolo visibile o al racconto.
- `/storie/<slug>`: titolo e description derivati dai sottotitoli esistenti nel CMS, senza attribuire diagnosi, ruolo dei familiari o dettagli non presenti. Fallback per dati vuoti e rimozione della formattazione Markdown dai soli metadata.
- Footer delle storie: collegamento alla pagina dell'associazione.
- Sitemap: nuova pagina pubblica inserita una sola volta. Canonical e metadati social coerenti. AboutPage, Organization e BreadcrumbList descrivono solo informazioni mostrate.
- Solo in `VERCEL_ENV=preview`: metadata robots `noindex, nofollow`, per evitare concorrenza con il dominio pubblico. Build e runtime production non ricevono questo override.

## Verifiche

- Build normale e build `VERCEL_ENV=preview`: superate, TypeScript incluso.
- ESLint sui file modificati: superato senza warning. Non dichiarato risolto il debito lint preesistente del progetto.
- Test contratti SEO esistenti: 3/3.
- Test helper metadata storie: 4/4, incluso contenuto CMS, fallback e formattazione.
- Test HTTP su build normale: 4/4; ripetuti in preview: 4/4. Verificano canonical, title, dati strutturati, collegamenti, sitemap e noindex solo in preview.
- Browser: homepage e Chi siamo a 320, 390 e 1440 px, nessun overflow orizzontale o errore JavaScript; navigazione al questionario e ritorno, logo caricato. Screenshot mobile e desktop controllati.
- Nessuna dipendenza, migrazione, modifica auth o modifica dei file logo.

I test sono locali senza credenziali CMS: la preview Vercel va verificata anche sui contenuti effettivamente presenti. Le anteprime non devono essere usate per inviare richieste o modificare dati reali. La nuova pagina Chi siamo è editoriale nel codice; i racconti mantengono la gestione CMS esistente.

## Riproduzione

```sh
npm ci
npm run build
npx tsc lib/storySeo.ts --outDir /tmp/insieme-story-seo-tests --target ES2022 --module commonjs --moduleResolution node --skipLibCheck
STORY_SEO_TEST_BUILD=/tmp/insieme-story-seo-tests node --test tests/story-seo.test.mjs tests/seo-contract.test.mjs
# Avviare la build in un terminale:
npm run start -- --hostname 127.0.0.1 --port 3044
# In un secondo terminale:
BASE_URL=http://127.0.0.1:3044 node --test tests/seo-public-pages.test.mjs
# Ripetere build e start con VERCEL_ENV=preview, test con EXPECT_PREVIEW=true.
```

## Limiti e seguito

Questa modifica prepara contenuti e percorsi più chiari; non dimostra una crescita organica né garantisce posizionamenti. L'export Search Console esaminato aveva 12 clic, 44 impressioni e nessuna query esportata: insufficiente per attribuire ranking alle keyword proposte.

Dopo un'eventuale approvazione e pubblicazione, verificare la nuova URL in Search Console, inviare la sitemap aggiornata e monitorare query, impressioni non di marca e contatti. Le pagine Volontariato e Sostienici richiedono prima modalità operative confermate e non sono incluse. Nessun merge, auto-merge o rilascio production autorizzato da questa preview.
