import type { Metadata } from "next";
import Link from "next/link";
import { LegalLinks } from "../components/LegalLinks";
import { InstitutionalLine } from "../components/InstitutionalLine";
import { cookiePolicy } from "../../lib/legal";
import { socialMetadata } from "../../lib/seo";
import "../storie/aurora/story.css";
import "../cookie-policy/legal.css";

const description =
  "Come Insieme Oltre ODV tratta i dati personali di chi visita il sito, contatta l’associazione o usa i servizi riservati.";

export const metadata: Metadata = {
  title: "Privacy Policy | Insieme Oltre",
  description,
  alternates: { canonical: "/privacy-policy" },
  ...socialMetadata({ title: "Privacy Policy | Insieme Oltre", description, path: "/privacy-policy" }),
};

const pec = "insiemeoltreodv@pec.it";
const email = "info@insiemeoltreischia.it";

const contactData = [
  "nome e cognome;",
  "indirizzo email;",
  "numero di telefono, se fornito;",
  "tipologia di contatto indicata dall’utente, ad esempio famiglia, volontario, professionista o collaboratore;",
  "contenuto del messaggio inviato.",
];

const memberData = [
  "richieste di adesione e accesso;",
  "anagrafiche dei soci;",
  "gestione dei volontari;",
  "attività amministrative;",
  "donazioni e altre entrate;",
  "emissione e conservazione delle ricevute;",
  "gestione contabile;",
  "adempimenti previsti dalla normativa applicabile.",
];

const accessData = [
  "credenziali e dati identificativi dell’utente;",
  "informazioni relative alla sessione;",
  "data e ora di accesso e dell’ultima attività;",
  "operazioni eseguite all’interno dell’area riservata, ove necessario per il funzionamento e la sicurezza del servizio.",
];

const legalBases = [
  "l’esecuzione del rapporto associativo o di misure richieste dall’interessato;",
  "l’adempimento di obblighi di legge;",
  "il legittimo interesse dell’Associazione alla corretta organizzazione e sicurezza delle proprie attività, quando applicabile.",
];

const threats = [
  "accessi non autorizzati;",
  "perdita;",
  "diffusione indebita;",
  "modifica;",
  "distruzione accidentale o illecita.",
];

const recipients = [
  "persone autorizzate da Insieme Oltre ODV;",
  "fornitori di servizi informatici e hosting;",
  "fornitori dei servizi di posta elettronica;",
  "fornitori di database e autenticazione;",
  "consulenti o professionisti quando necessario;",
  "autorità pubbliche o altri soggetti quando previsto dalla legge.",
];

const rights = [
  "ottenere conferma dell’esistenza o meno di dati personali che lo riguardano;",
  "accedere ai propri dati;",
  "chiedere la rettifica dei dati inesatti;",
  "chiedere la cancellazione dei dati;",
  "chiedere la limitazione del trattamento;",
  "opporsi al trattamento quando previsto;",
  "ricevere i propri dati in formato portabile, quando applicabile;",
  "revocare il consenso in qualsiasi momento, quando il trattamento è basato sul consenso;",
  "presentare reclamo al Garante per la protezione dei dati personali.",
];

function List({ items }: { items: string[] }) {
  return (
    <ul className="legal-list">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

export default function PrivacyPolicyPage() {
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
          <p className="legal-lead">Ultimo aggiornamento: 27 ottobre 2026</p>
        </header>

        <section className="legal-section">
          <p>
            La presente informativa descrive le modalità con cui <strong>Insieme Oltre ODV</strong> tratta i dati personali degli
            utenti del sito <strong>www.insiemeoltreischia.it</strong>, delle persone che contattano l’Associazione e dei soggetti
            che interagiscono con i servizi riservati.
          </p>
        </section>

        <section className="legal-section">
          <h2>1. Titolare del trattamento</h2>
          <p>Il Titolare del trattamento è:</p>
          <p className="legal-highlight">
            <strong>Insieme Oltre ODV</strong>
            <br />
            C.F. <strong>91019080638</strong>
            <br />
            Via Rosato 4
            <br />
            80072 Barano d’Ischia (NA)
          </p>
          <p>Per richieste relative alla protezione dei dati personali è possibile contattare l’Associazione tramite PEC:</p>
          <p><strong><a href={`mailto:${pec}`}>{pec}</a></strong></p>
          <p>L’indirizzo ordinario dell’Associazione è:</p>
          <p><strong><a href={`mailto:${email}`}>{email}</a></strong></p>
        </section>

        <section className="legal-section">
          <h2>2. Quali dati trattiamo</h2>
          <p>
            A seconda del modo in cui una persona interagisce con il sito e con l’Associazione, possono essere trattati differenti
            tipi di dati.
          </p>

          <h3>Contatti tramite il sito</h3>
          <p>Il modulo “Parla con noi / Unisciti a noi” può raccogliere:</p>
          <List items={contactData} />
          <p>
            Invitiamo gli utenti a non inserire nel messaggio informazioni sanitarie o altri dati particolarmente delicati se non
            strettamente necessario.
          </p>

          <h3>Soci, volontari e persone autorizzate</h3>
          <p>Nell’ambito della gestione associativa possono essere trattati dati necessari a:</p>
          <List items={memberData} />

          <h3>Area riservata e amministrativa</h3>
          <p>L’accesso alle aree riservate del sito è consentito esclusivamente a persone autorizzate.</p>
          <p>Per la gestione dell’accesso possono essere trattati:</p>
          <List items={accessData} />

          <h3>Storie, fotografie e contenuti pubblicati</h3>
          <p>
            Il sito può pubblicare storie, fotografie e altri contenuti relativi alle persone e alle famiglie che partecipano alle
            attività dell’Associazione.
          </p>
          <p>
            Quando i contenuti riguardano minori, la pubblicazione avviene sulla base di una <strong>liberatoria e di un consenso
            scritto sottoscritti da chi esercita la responsabilità genitoriale</strong>.
          </p>
          <p>
            Le liberatorie cartacee sono conservate presso la sede legale dell’Associazione in un armadio chiuso a chiave.
          </p>
          <p>
            Quando una storia contiene informazioni relative alla salute, alla disabilità o altre categorie particolari di dati
            personali, tali informazioni vengono trattate e pubblicate solo quando sussiste un’idonea base giuridica e, ove
            richiesto, uno specifico consenso.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. Finalità e basi giuridiche del trattamento</h2>
          <p>I dati personali vengono trattati esclusivamente per finalità determinate e pertinenti.</p>

          <h3>Rispondere alle richieste di contatto</h3>
          <p>
            I dati inviati attraverso il modulo vengono utilizzati per leggere la richiesta, ricontattare l’interessato e fornire
            le informazioni richieste.
          </p>
          <p>
            La base giuridica è il consenso espresso dall’interessato e, quando applicabile, l’esecuzione di misure adottate su
            sua richiesta.
          </p>

          <h3>Gestione dell’Associazione</h3>
          <p>
            I dati di soci, volontari, collaboratori e altri soggetti vengono trattati per la gestione del rapporto con
            l’Associazione, delle adesioni, delle attività associative e degli adempimenti amministrativi.
          </p>
          <p>Le basi giuridiche possono essere:</p>
          <List items={legalBases} />

          <h3>Contabilità, ricevute e adempimenti</h3>
          <p>
            I dati relativi a donazioni, ricevute, movimenti contabili e documenti amministrativi vengono trattati per la corretta
            gestione dell’Associazione e per l’adempimento degli obblighi previsti dalla legge.
          </p>

          <h3>Pubblicazione di storie e immagini</h3>
          <p>
            La pubblicazione di storie, fotografie e altri contenuti personali avviene sulla base del consenso dell’interessato
            o, nel caso di minori, del consenso di chi esercita la responsabilità genitoriale.
          </p>
          <p>
            Per eventuali categorie particolari di dati, come informazioni relative alla salute o alla disabilità, viene
            acquisito, quando necessario, un consenso esplicito.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Modalità del trattamento e sicurezza</h2>
          <p>I dati vengono trattati con strumenti informatici e, in alcuni casi, con documentazione cartacea.</p>
          <p>Insieme Oltre ODV adotta misure tecniche e organizzative volte a proteggere i dati da:</p>
          <List items={threats} />
          <p>L’accesso alle aree amministrative e ai dati dell’Associazione è limitato alle persone autorizzate.</p>
        </section>

        <section className="legal-section">
          <h2>5. Servizi utilizzati</h2>
          <p>Per il funzionamento del sito e dei servizi collegati, Insieme Oltre ODV utilizza alcuni fornitori esterni.</p>

          <h3>Vercel</h3>
          <p>Il sito è ospitato tramite l’infrastruttura di <strong>Vercel</strong>.</p>
          <p>
            Durante la normale navigazione possono essere trattati dati tecnici necessari alla connessione e alla sicurezza del
            servizio, come indirizzo IP, user agent, data e ora della richiesta e pagina richiesta.
          </p>

          <h3>Supabase</h3>
          <p>
            <strong>Supabase</strong> viene utilizzato per alcune funzioni dell’area riservata, per l’autenticazione degli
            utenti autorizzati e per la gestione dei dati necessari al funzionamento dei servizi amministrativi.
          </p>
          <p>Supabase non viene utilizzato per attività di profilazione dei visitatori del sito pubblico.</p>

          <h3>Brevo</h3>
          <p>Il servizio <strong>Brevo</strong> viene utilizzato per l’invio delle comunicazioni email generate dal sito.</p>
          <p>
            Quando un utente invia il modulo di contatto, i dati necessari alla gestione della richiesta possono essere trasmessi
            tramite Brevo affinché il messaggio venga recapitato all’Associazione.
          </p>

          <h3>Infomaniak</h3>
          <p>
            <strong>Infomaniak</strong> viene utilizzato per la gestione della posta elettronica dell’Associazione. I messaggi
            inviati all’indirizzo dell’Associazione possono quindi essere trattati attraverso l’infrastruttura del provider di
            posta.
          </p>
          <p>
            I fornitori esterni trattano i dati secondo i rispettivi ruoli e gli accordi applicabili in materia di protezione
            dei dati personali.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Trasferimenti di dati</h2>
          <p>
            Alcuni fornitori tecnologici utilizzati dall’Associazione possono operare attraverso infrastrutture distribuite in
            più Paesi.
          </p>
          <p>
            Quando un trattamento comporta un trasferimento di dati personali al di fuori dello Spazio Economico Europeo, il
            trasferimento deve avvenire nel rispetto delle condizioni previste dal Regolamento (UE) 2016/679 e delle garanzie
            applicabili.
          </p>
          <p>L’Associazione verifica, per quanto di propria competenza, le condizioni offerte dai fornitori utilizzati.</p>
        </section>

        <section className="legal-section">
          <h2>7. Tempi di conservazione</h2>
          <p>I dati vengono conservati soltanto per il periodo necessario alle finalità per cui sono stati raccolti.</p>

          <h3>Richieste di contatto</h3>
          <p>
            I dati inviati attraverso il modulo “Parla con noi / Unisciti a noi” vengono conservati <strong>solo per il tempo
            necessario a gestire e rispondere alla richiesta</strong>, salvo che dalla comunicazione nasca un successivo rapporto
            con l’Associazione o sussista un obbligo di conservazione.
          </p>

          <h3>Dati associativi, contabili e amministrativi</h3>
          <p>
            I dati relativi a soci, volontari, ricevute, contabilità e documentazione amministrativa vengono conservati per tutta
            la durata necessaria alla gestione del rapporto e, successivamente, per i periodi previsti dalla normativa
            applicabile.
          </p>

          <h3>Consensi, liberatorie e contenuti pubblicati</h3>
          <p>
            Le liberatorie e i consensi relativi alla pubblicazione di storie e immagini vengono conservati per il periodo
            necessario a documentare la liceità della pubblicazione e a gestire eventuali richieste dell’interessato.
          </p>
          <p>
            L’interessato può chiedere la revoca del consenso nei casi in cui il trattamento sia basato sul consenso, fatti salvi
            i trattamenti effettuati prima della revoca e gli eventuali obblighi di legge.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Cookie, analytics e strumenti di tracciamento</h2>
          <p className="legal-highlight">
            Al momento il sito pubblico <strong>non utilizza strumenti di profilazione, Google Analytics, Meta Pixel, Vercel
            Analytics o altri sistemi di tracciamento pubblicitario o comportamentale</strong>.
          </p>
          <p>Non vengono utilizzati cookie di profilazione.</p>
          <p>
            Le informazioni necessarie alla sessione dell’area amministrativa vengono memorizzate esclusivamente nell’ambiente
            riservato e sono utilizzate per autenticazione e sicurezza.
          </p>
          <p>
            Per maggiori dettagli è possibile consultare la{" "}
            {cookiePolicy.published
              ? <Link href={cookiePolicy.href}><strong>Cookie Policy</strong></Link>
              : <strong>Cookie Policy</strong>}{" "}
            del sito.
          </p>
        </section>

        <section className="legal-section">
          <h2>9. Conferimento dei dati</h2>
          <p>Il conferimento dei dati attraverso il modulo di contatto è facoltativo.</p>
          <p>
            Tuttavia, senza i dati indicati come obbligatori, l’Associazione potrebbe non essere in grado di rispondere alla
            richiesta.
          </p>
          <p>
            Per i soci, i volontari e gli utenti dell’area riservata, alcuni dati possono essere necessari per la gestione del
            rapporto associativo o per adempiere agli obblighi di legge.
          </p>
        </section>

        <section className="legal-section">
          <h2>10. Comunicazione dei dati</h2>
          <p>I dati possono essere trattati da:</p>
          <List items={recipients} />
          <p>I dati non vengono venduti né utilizzati per finalità pubblicitarie o di profilazione.</p>
        </section>

        <section className="legal-section">
          <h2>11. Diritti degli interessati</h2>
          <p>
            Nei casi previsti dalla normativa, l’interessato può esercitare i propri diritti in materia di protezione dei dati
            personali, tra cui:
          </p>
          <List items={rights} />
          <p>La revoca del consenso non pregiudica la liceità del trattamento effettuato prima della revoca.</p>
        </section>

        <section className="legal-section">
          <h2>12. Come esercitare i propri diritti</h2>
          <p>Le richieste relative alla protezione dei dati personali possono essere inviate a:</p>
          <p className="legal-highlight">
            <strong>Insieme Oltre ODV</strong>
            <br />
            PEC: <strong><a href={`mailto:${pec}`}>{pec}</a></strong>
          </p>
          <p>L’Associazione risponderà nei tempi previsti dalla normativa applicabile.</p>
        </section>

        <section className="legal-section">
          <h2>13. Dati dei minori</h2>
          <p>Insieme Oltre ODV presta particolare attenzione alla tutela dei dati personali dei minori.</p>
          <p>
            Storie, fotografie o altri contenuti relativi a minori vengono pubblicati solo previa acquisizione di una liberatoria
            e del consenso scritto di chi esercita la responsabilità genitoriale.
          </p>
          <p>La pubblicazione è limitata ai dati e ai contenuti autorizzati.</p>
          <p>
            L’Associazione evita di pubblicare informazioni non necessarie e può rimuovere o aggiornare i contenuti su richiesta,
            compatibilmente con gli obblighi di legge e con le caratteristiche tecniche dei servizi utilizzati.
          </p>
        </section>

        <section className="legal-section">
          <h2>14. WhatsApp</h2>
          <p>
            Il servizio WhatsApp dell’Associazione è attualmente <strong>in fase di preparazione e non è ancora utilizzato per il
            trattamento dei dati tramite il sito</strong>.
          </p>
          <p>
            Prima dell’attivazione della futura integrazione con <strong>Meta WhatsApp Cloud API</strong>, questa informativa
            verrà aggiornata per descrivere il relativo trattamento dei dati.
          </p>
        </section>

        <section className="legal-section">
          <h2>15. Modifiche alla Privacy Policy</h2>
          <p>
            La presente informativa può essere aggiornata nel tempo, ad esempio in caso di introduzione di nuovi servizi,
            modifiche tecniche o cambiamenti normativi.
          </p>
          <p>
            La versione aggiornata sarà pubblicata su questa pagina con indicazione della data dell’ultimo aggiornamento.
          </p>
          <p className="legal-updated">Ultimo aggiornamento: 27 ottobre 2026</p>
        </section>
      </article>

      <footer className="aurora-page-footer">
        <Link href="/">Insieme Oltre</Link>
        <div className="aurora-page-footer-end">
          <span>L’amore non si misura in cromosomi.</span>
          <LegalLinks className="aurora-page-legal" />
          <InstitutionalLine className="aurora-page-institutional" />
        </div>
      </footer>
    </main>
  );
}
