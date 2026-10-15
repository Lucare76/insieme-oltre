# Attivazione delle email dal modulo «Parla con noi»

Il modulo invia messaggi a `info@insiemeoltreischia.it` tramite la API HTTP di Brevo. La casella ricevente è ospitata su Infomaniak; **non** occorre cambiare il record MX del dominio né sostituire lo SPF Infomaniak.

## Prima di attivare il modulo

1. Verificare che `info@insiemeoltreischia.it` invii e riceva posta nella Webmail Infomaniak.
2. In Brevo, confermare `info@insiemeoltreischia.it` come mittente autorizzato (e, se richiesto, autenticare il dominio tramite i soli DNS indicati da Brevo, preservando quelli esistenti).
3. In Vercel, nel progetto **insieme-oltre**, in **Settings → Environment Variables**, configurare:
   - `BREVO_API_KEY` = chiave API v3 (solo server, segreta);
   - `CONTACT_FROM_EMAIL` = `info@insiemeoltreischia.it` (mittente verificato in Brevo);
   - `CONTACT_TO_EMAIL` = `info@insiemeoltreischia.it` (facoltativa: è già il valore predefinito).
   Tutte come variabili Production; evitare `NEXT_PUBLIC_` e non scrivere chiavi in GitHub o nella chat.
4. Effettuare un **nuovo deploy Production** dopo aver salvato le variabili: un deployment già esistente non acquisisce automaticamente nuove configurazioni.
5. Controllare e far validare al referente legale l'informativa in `/informativa-contatti`, inclusi dati giuridici del titolare, base giuridica, durata di conservazione effettiva e trasferimenti internazionali.

Il modulo nella homepage si abilita soltanto se le credenziali server di Brevo sono presenti e formalmente valide. Fino ad allora, offre il contatto diretto via `mailto:`. La sola presenza delle credenziali non garantisce la consegna: servono i test qui sotto.

## Prova operativa

1. Aprire `/#unisciti` in una finestra privata, compilare con indirizzo email personale e messaggio non sensibile.
2. Controllare che compaia «Messaggio inviato».
3. Verificare l'arrivo del messaggio in Infomaniak, cartella Spam inclusa.
4. Provare «Rispondi»: il destinatario della risposta deve essere l'indirizzo email compilato nel modulo (header Reply-To).
5. Se il modulo rimane disabilitato, ricontrollare le variabili Vercel e il deploy. Se l'invio fallisce, consultare i log Vercel e i log transazionali Brevo senza pubblicare credenziali.

La conferma HTTP positiva prova soltanto l'accettazione di Brevo, non la consegna effettiva in casella. Il questionario anonimo è indipendente dal modulo contatti.
