import type { Metadata } from "next";
import Link from "next/link";
import { FooterLinks } from "../components/FooterLinks";
import { InstitutionalLine } from "../components/InstitutionalLine";
import { association, associationAddress } from "../../lib/association";
import { cookiePolicy } from "../../lib/legal";
import { socialMetadata } from "../../lib/seo";
import "../storie/aurora/story.css";
import "../cookie-policy/legal.css";

const description =
  "Come Insieme Oltre ODV tratta i dati personali di chi visita il sito o scrive all’associazione: nessun modulo, nessun tracciamento, nessuna profilazione.";

export const metadata: Metadata = {
  title: "Privacy Policy | Insieme Oltre",
  description,
  alternates: { canonical: "/privacy-policy" },
  ...socialMetadata({ title: "Privacy Policy | Insieme Oltre", description, path: "/privacy-policy" }),
};

// Solo trattamenti che risultano dal codice del sito: niente moduli, newsletter, analytics o pubblicità.
const rights = [
  "accedere ai propri dati e riceverne copia;",
  "chiederne la rettifica o la cancellazione;",
  "chiedere la limitazione del trattamento od opporsi;",
  "chiedere la portabilità dei dati, nei casi previsti;",
  "revocare in ogni momento il consenso eventualmente prestato.",
];

export default function PrivacyPolicyPage() {
  const mail = <a href={`mailto:${association.email}`}>{association.email}</a>;

  return (
    <main className="aurora-page">
      <header className="aurora-page-header">
        <Link href="/" className="aurora-page-brand">Insieme <em>Oltre</em></Link>
        <Link href="/" className="aurora-page-back">← Torna al sito</Link>
      </header>

      <article className="legal">
        <header className="legal-intro">
          <p className="legal-kicker">Informazioni sul sito</p>
          <h1>Privacy Policy</h1>
          <p className="legal-lead">Informativa sul trattamento dei dati personali ai sensi del Regolamento (UE) 2016/679</p>
        </header>

        <section className="legal-section">
          <h2>Titolare del trattamento</h2>
          <p className="legal-highlight">
            <strong>{association.name}</strong>
            <br />
            {associationAddress}
            <br />
            C.F. {association.taxCode}
            <br />
            {mail}
          </p>
          <p>Per qualsiasi domanda su questa informativa o sui tuoi dati puoi scrivere all’indirizzo email indicato.</p>
        </section>

        <section className="legal-section">
          <h2>Cosa raccoglie il sito</h2>
          <p className="legal-highlight">
            Il sito pubblico <strong>non contiene moduli di contatto, registrazioni o newsletter</strong> e non utilizza cookie,
            strumenti di analisi statistica, pixel pubblicitari o sistemi di profilazione.
          </p>
          <p>
            Per i dettagli su cookie e tecnologie simili puoi consultare la{" "}
            <Link href={cookiePolicy.href}>Cookie Policy</Link>.
          </p>
        </section>

        <section className="legal-section">
          <h2>Dati di navigazione</h2>
          <p>
            Per mostrare le pagine, l’infrastruttura che ospita il sito riceve i dati tecnici che ogni browser trasmette durante
            la navigazione, come l’indirizzo IP, il tipo di browser, la pagina richiesta e l’orario della richiesta.
          </p>
          <p>
            Questi dati servono solo a erogare il sito e a garantirne la sicurezza e il corretto funzionamento. L’associazione non
            li usa per identificare i visitatori né per creare profili.
          </p>
        </section>

        <section className="legal-section">
          <h2>Se ci scrivi</h2>
          <p>
            Se scrivi a {mail}, useremo il tuo indirizzo email e quanto ci racconti nel messaggio solo per risponderti e per dare
            seguito alla tua richiesta. Ti chiediamo di non inviare informazioni sulla salute o altri dati delicati che non siano
            necessari.
          </p>
        </section>

        <section className="legal-section">
          <h2>Storie e immagini pubblicate</h2>
          <p>
            Il sito racconta le storie di alcune persone vicine all’associazione, a volte con fotografie. Chi è ritratto o citato,
            o chi ne esercita la responsabilità genitoriale, può chiedere in qualsiasi momento di modificare o rimuovere testi e
            immagini scrivendo a {mail}.
          </p>
        </section>

        <section className="legal-section">
          <h2>Area amministrativa</h2>
          <p>
            Il sito dispone di un’area riservata agli amministratori autorizzati, usata per aggiornare i contenuti delle pagine.
            L’accesso avviene con credenziali personali; l’autenticazione e l’archiviazione dei contenuti si appoggiano al servizio
            Supabase.
          </p>
          <p>Quest’area non raccoglie dati dei visitatori del sito pubblico.</p>
        </section>

        <section className="legal-section">
          <h2>Fornitori tecnici</h2>
          <p>
            Per funzionare il sito si avvale di fornitori di servizi tecnici (hosting, autenticazione e archiviazione dei contenuti
            dell’area amministrativa, posta elettronica), che trattano i dati solo nella misura necessaria a erogare il servizio,
            secondo le rispettive condizioni e informative.
          </p>
          <p>I dati non vengono venduti né ceduti a terzi per finalità commerciali o pubblicitarie.</p>
        </section>

        <section className="legal-section">
          <h2>I tuoi diritti</h2>
          <p>In qualsiasi momento puoi:</p>
          <ul className="legal-list">
            {rights.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p>
            Per esercitare questi diritti scrivi a {mail}. Hai inoltre il diritto di proporre reclamo al Garante per la protezione
            dei dati personali (<a href="https://www.garanteprivacy.it" rel="noopener noreferrer">www.garanteprivacy.it</a>).
          </p>
        </section>

        <section className="legal-section">
          <h2>Aggiornamenti</h2>
          <p>
            Questa informativa potrà essere aggiornata se cambieranno i servizi o le funzionalità del sito. La versione aggiornata
            sarà sempre disponibile su questa pagina.
          </p>
          <p className="legal-updated">Ultimo aggiornamento: ottobre 2026</p>
        </section>
      </article>

      <footer className="aurora-page-footer">
        <Link href="/">Insieme Oltre</Link>
        <div className="aurora-page-footer-end">
          <span>L’amore non si misura in cromosomi.</span>
          <FooterLinks className="aurora-page-legal" />
          <InstitutionalLine className="aurora-page-institutional" />
        </div>
      </footer>
    </main>
  );
}
