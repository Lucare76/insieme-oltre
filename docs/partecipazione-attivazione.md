# Questionario «Da dove cominciamo?» – rilascio

## Stato del codice
- \`/partecipa\`: pagina mobile-first con scelte per famiglie, persone con sindrome di Down e volontari.
- \`POST /api/partecipa\`: salva soltanto ruolo, fascia d'età, massimo tre priorità, quattro domande facoltative per organizzare le attività e un suggerimento facoltativo (max 350 caratteri). Non salva indirizzi IP, nomi, email, dati medici.
- \`/admin/partecipazioni\`: riepilogo protetto dalla stessa autenticazione del pannello e CSV con protezione anti-formule.
- RLS sul database: nessuna policy per \`anon\` o \`authenticated\`; accesso tramite backend \`service_role\` dopo verifica admin.

## Prima di abilitare l'invio
1. Applicare nel progetto Supabase **usato dal sito** le migrazioni \`supabase/migrations/20261015160000_participation_submissions.sql\` e poi \`supabase/migrations/20261015170000_participation_planning_questions.sql\`.
2. Completare l'informativa privacy ufficiale del titolare con le finalità, tempi di conservazione, contatti e modalità di esercizio dei diritti. Pubblicare \`/privacy-policy\` e solo allora porre \`privacyPolicy.published = true\` in \`lib/legal.ts\`. Non attivare prima.
3. Verificare in Vercel \`NEXT_PUBLIC_SUPABASE_URL\`, \`SUPABASE_SERVICE_ROLE_KEY\`, \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`, \`ADMIN_ALLOWED_EMAIL\`.
4. Verificare invio test, riapertura del pannello admin, conteggi, esportazione CSV e protezione GET admin (401 senza token).
5. Solo dopo il test pubblico, distribuire il flyer A4 con il QR per \`https://insiemeoltreischia.it/partecipa\` (o il dominio canonico verificato).

## Note operative
- Il form non chiede contatti: non è un'iscrizione né invia risposte via email.
- Rate limit in-memory (best effort), non un controllo distribuito. Per volumi elevati valutare rate limiting persistente / CAPTCHA rispettoso della privacy.
- Pianificare una politica di cancellazione periodica delle risposte e di moderazione dei suggerimenti; non usare i testi liberi per profilazione.
- I conteggi nell'admin mostrano al massimo le ultime 500 risposte e segnano esplicitamente il campione parziale.
