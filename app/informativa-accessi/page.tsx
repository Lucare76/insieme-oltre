import Link from "next/link";
export const metadata = {
  title: "Informativa area riservata | Insieme Oltre",
  robots: { index: false, follow: false },
};
export default function AccessNotice() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "40px auto",
        padding: 24,
        lineHeight: 1.7,
      }}
    >
      <Link href="/admin">← Torna all’accesso</Link>
      <h1>Dati dell’area riservata</h1>
      <p>
        Insieme Oltre ODV utilizza nome e cognome, email e nome utente per
        esaminare la richiesta di accesso, verificare l’appartenenza
        all’associazione e gestire l’account. La richiesta non abilita
        automaticamente alcun accesso: l’admin decide se approvarla e quale
        ruolo assegnare.
      </p>
      <p>
        Nome utente ed email sono utilizzati per l’autenticazione e le
        comunicazioni relative all’account. La password viene scelta
        personalmente dall’utente tramite un collegamento monouso; non viene
        mostrata all’admin. Non inserire dati sanitari o informazioni sui
        bambini nella richiesta.
      </p>
      <p>
        Le richieste e i permessi sono visibili all’admin principale. Le
        operazioni di amministrazione e contabilità sono registrate nello
        storico per consentire controlli e ricostruire le modifiche. I soci
        vedono i riepiloghi contabili previsti dal loro ruolo; note riservate e
        giustificativi restano agli amministratori autorizzati.
      </p>
      <p>
        Il servizio usa Supabase per dati e autenticazione, Vercel per il sito e
        Brevo per le email. I dati delle richieste vengono conservati per
        gestirne l’esito; i dati degli account e i registri sono conservati per
        le esigenze di gestione e tracciabilità dell’associazione. La
        disattivazione blocca l’accesso e non cancella automaticamente lo
        storico contabile.
      </p>
      <p>
        Per informazioni, correzioni o richieste sui dati contatta{" "}
        <a href="mailto:info@insiemeoltreischia.it">
          info@insiemeoltreischia.it
        </a>
        . L’invio della richiesta serve esclusivamente all’abilitazione
        dell’area riservata, senza iscrizione a newsletter.
      </p>
    </main>
  );
}
