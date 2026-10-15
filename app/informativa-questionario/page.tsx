import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Informazioni sul questionario | Insieme Oltre",
  robots: { index: false, follow: false },
};

export default function InformativaQuestionario() {
  return (
    <main style={{ background: "#fffaf4", color: "#24312a", minHeight: "100vh", padding: "36px 20px", lineHeight: 1.7 }}>
      <article style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link href="/partecipa" style={{ textDecoration: "underline" }}>← Torna al questionario</Link>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(34px,6vw,56px)", lineHeight: 1.05, marginTop: 36 }}>
          Come utilizziamo le tue risposte
        </h1>
        <p><strong>Insieme Oltre</strong> raccoglie queste risposte per capire quali attività e servizi proporre sul territorio, ascoltando persone di tutte le età, famiglie e volontari.</p>
        <h2>Cosa chiediamo</h2>
        <p>Ruolo con cui partecipi, fascia d'età di interesse, attività preferite, necessità organizzative e suggerimenti facoltativi. Non chiediamo nome, indirizzo, telefono, email né informazioni cliniche. Ti invitiamo a non inserire dati personali, nomi di terzi o informazioni sanitarie nello spazio libero.</p>
        <h2>Come vengono utilizzate</h2>
        <p>Le risposte sono usate per definire le priorità dell'associazione e consultate dalle persone autorizzate. Vengono ricevute tramite il database del sito oppure tramite l'email organizzativa dell'associazione quando il database non è disponibile. Il sito si appoggia a fornitori tecnologici per l'hosting e, per l'invio email, a Brevo. Non useremo le risposte per creare profili commerciali.</p>
        <h2>Partecipazione volontaria</h2>
        <p>Puoi non rispondere alle domande facoltative. Il questionario non comporta iscrizione all'associazione e non permette di ricontattarti. Anche se non chiediamo identificativi, il normale funzionamento dei servizi web può comportare il trattamento temporaneo di dati tecnici di connessione; non inserire informazioni che permettano di riconoscerti.</p>
        <h2>Informazioni e diritti</h2>
        <p>Per domande sulla gestione delle risposte, sulle modalità di conservazione o per esercitare i diritti previsti dalla normativa sulla protezione dei dati, scrivi a <a href="mailto:info@insiemeoltreischia.it" style={{ textDecoration: "underline" }}>info@insiemeoltreischia.it</a>. In assenza di identificativi potrebbe non essere possibile individuare una specifica risposta già inviata.</p>
        <p style={{ fontSize: 13, color: "#556158", marginTop: 36 }}>Questa informazione riguarda solo il questionario «Da dove cominciamo?» e non sostituisce l'informativa generale del sito. Il testo potrà essere aggiornato con il supporto legale dell'associazione.</p>
      </article>
    </main>
  );
}
