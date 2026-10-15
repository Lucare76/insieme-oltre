# Attivazione e verifica del questionario – Insieme Oltre

## Percorso per chi partecipa
- Link pubblico `/partecipa`, accessibile con QR da desktop e smartphone.
- Nessuna iscrizione, nessun nome, email o telefono richiesto.
- Informazioni specifiche disponibili in `/informativa-questionario`, richiamate vicino al pulsante di invio. L'informativa generale del sito resta separata e non viene fittiziamente dichiarata pubblicata.
- Domande facoltative per comprendere esigenze, orari, difficoltà e disponibilità a collaborare; una sola risposta per invio.

## Come viene ricevuta una risposta
1. Il backend convalida tutte le scelte, il limite di testo e la presa visione delle informazioni.
2. Tenta di registrare la risposta nella tabella privata Supabase `participation_submissions`.
3. Se il database non è disponibile, tenta la consegna all'email organizzativa tramite la configurazione Brevo del modulo contatti. Il messaggio di successo compare **solo quando Supabase o Brevo confermano l'accettazione**.
4. Le risposte via email **non** sono comprese nel conteggio di `/admin/partecipazioni`; consultare anche la casella della posta dell'associazione.
5. In caso di errore di entrambi i sistemi, restituisce un messaggio senza affermare che la risposta sia stata salvata.

## Verifiche necessarie
- Controllare la pubblicazione e l'adeguatezza dei testi in `/informativa-questionario` con il legale dell'associazione, i riferimenti del titolare del trattamento e le condizioni reali di conservazione.
- In Vercel controllare `BREVO_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL`; il mittente deve essere verificato in Brevo.
- Nel database del progetto effettivo eseguire, in ordine, le migrazioni `20261015160000_participation_submissions.sql` e `20261015170000_participation_planning_questions.sql`.
- Testare il modulo su cellulare e desktop, con una risposta chiaramente di prova.
- Controllare la conferma server e la ricezione effettiva in Supabase **oppure** nella casella email.
- Verificare che `/api/admin/partecipazioni` rifiuti accessi senza autenticazione.
- Non far stampare o distribuire il QR finché un invio reale non è stato verificato.

## Note
- Il modulo non memorizza nominativi o recapiti; il campo di testo libero può però ricevere dati identificativi se inseriti dall'utente. Va ricordato di evitarli.
- Il semplice QR funzionante prova solo l'apertura della pagina, non la capacità di ricevere le risposte.
- Il limite richieste è "best effort" per processo: non è un rate limit distribuito.
