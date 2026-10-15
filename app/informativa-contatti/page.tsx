import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Informativa contatti | Insieme Oltre",
  robots: { index: false, follow: false },
};

export default function InformativaContatti() {
  return (
    <main style={{ background: "#fffaf4", color: "#24312a", minHeight: "100vh", padding: "36px 20px", lineHeight: 1.7 }}>
      <article style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link href="/#unisciti" style={{ textDecoration: "underline" }}>← Torna a Parla con noi</Link>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(34px,6vw,56px)", lineHeight: 1.05, marginTop: 36 }}>
          Come trattiamo i messaggi che ci invii
        </h1>
        <p>Questa informativa riguarda il modulo «Parla con noi» del sito di <strong>Insieme Oltre</strong>. Per informazioni sul titolare del trattamento e per qualsiasi richiesta relativa ai tuoi dati, puoi scrivere a <a href="mailto:info@insiemeoltreischia.it">info@insiemeoltreischia.it</a>.</p>
        <h2>Quali dati raccogliamo e perché</h2>
        <p>Raccogliamo nome e cognome, indirizzo email, ruolo indicato e contenuto del messaggio, oltre al numero di telefono se lo fornisci. Li utilizziamo esclusivamente per rispondere alla tua richiesta, organizzare eventuali contatti successivi e gestire la relativa corrispondenza. Il trattamento è basato sulla necessità di rispondere alle richieste che ci invii e sul legittimo interesse dell'associazione a gestire le comunicazioni ricevute, nei limiti previsti dall'art. 6 del GDPR.</p>
        <h2>Dati delicati</h2>
        <p>Ti chiediamo di non inserire diagnosi, documentazione sanitaria o altri dati particolarmente delicati nel messaggio. Per situazioni personali che richiedano riservatezza, scrivici prima per concordare un canale adeguato.</p>
        <h2>Chi può leggere il messaggio</h2>
        <p>Le richieste sono accessibili soltanto alle persone autorizzate dell'associazione. Il sito utilizza fornitori tecnici per l'hosting e la consegna dei messaggi, tra cui Vercel, Brevo e il servizio di posta Infomaniak. Gli eventuali trasferimenti internazionali di dati devono rispettare le garanzie previste dalla normativa applicabile.</p>
        <h2>Conservazione</h2>
        <p>I messaggi sono conservati per il tempo necessario a rispondere e a seguire la richiesta e vengono rimossi quando non sono più necessari, fatti salvi eventuali obblighi di legge o esigenze di tutela dei diritti.</p>
        <h2>I tuoi diritti</h2>
        <p>Puoi scrivere a <a href="mailto:info@insiemeoltreischia.it">info@insiemeoltreischia.it</a> per chiedere accesso, rettifica, cancellazione, limitazione o opposizione al trattamento, nei casi previsti dalla legge. Puoi inoltre presentare un reclamo al Garante per la protezione dei dati personali.</p>
        <p style={{ fontSize: 13, color: "#556158", marginTop: 36 }}>Questa informativa riguarda i soli messaggi inviati tramite «Parla con noi». Deve essere verificata e completata con i dati giuridici e le procedure effettive dell'associazione dal referente incaricato della privacy.</p>
      </article>
    </main>
  );
}
