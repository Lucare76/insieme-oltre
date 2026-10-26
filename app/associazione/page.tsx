import type { Metadata } from "next";
import Link from "next/link";
import { FooterLinks } from "../components/FooterLinks";
import { InstitutionalLine } from "../components/InstitutionalLine";
import { association, associationAddress, board } from "../../lib/association";
import { socialMetadata } from "../../lib/seo";
import "../storie/aurora/story.css";
import "./associazione.css";

const title = "L’associazione | Insieme Oltre ODV Ischia";
const description =
  "Scopri Insieme Oltre ODV, l’associazione nata a Ischia per sostenere famiglie, promuovere inclusione, autonomia e partecipazione nella comunità.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/associazione" },
  ...socialMetadata({ title, description, path: "/associazione" }),
};

const purposes = [
  "tutela dei diritti delle persone con trisomia 21 e altre disabilità intellettive o relazionali;",
  "inclusione sociale;",
  "valorizzazione delle attitudini e sviluppo delle autonomie personali e relazionali;",
  "sostegno alle famiglie;",
  "partecipazione alla vita della comunità dell’isola d’Ischia.",
];

// Attività previste dallo Statuto, non ancora tutte avviate: per questo sono scritte come intenzioni.
const activities = [
  {
    title: "Famiglie",
    text: "Ci proponiamo di offrire orientamento ai servizi e alle pratiche burocratico-amministrative, sostegno alla genitorialità e reti di mutuo aiuto tra famiglie.",
  },
  {
    title: "Educazione e crescita",
    text: "Vogliamo costruire progetti educativi individualizzati e laboratori di potenziamento cognitivo, partendo dagli interessi e dai tempi di ciascuno.",
  },
  {
    title: "Autonomia",
    text: "Lavoriamo per creare percorsi verso l’autonomia personale e relazionale, fino all’autonomia abitativa e lavorativa.",
  },
  {
    title: "Cultura e inclusione",
    text: "Ci proponiamo di promuovere attività culturali, artistiche ed editoriali e iniziative che diffondano la cultura dell’inclusione.",
  },
  {
    title: "Tempo libero e sport",
    text: "Vogliamo creare occasioni di tempo libero integrato, attività sportive adattate e iniziative turistiche di interesse sociale e culturale sul territorio.",
  },
  {
    title: "Comunità",
    text: "Vogliamo attività aperte anche alla comunità locale, costruite insieme a scuole, associazioni, professionisti e realtà dell’isola.",
  },
];

const principles = [
  "Universal Design: luoghi e attività pensati fin dall’inizio per essere accessibili a tutti;",
  "un’inclusione sostenibile, che duri nel tempo;",
  "nessuna ghettizzazione e nessun isolamento sociale;",
  "attività aperte anche alla comunità locale;",
  "legami sociali paritari, tra persone con e senza disabilità.",
];

export default function AssociazionePage() {
  const details = [
    { label: "Denominazione", value: association.name },
    { label: "Costituita il", value: association.foundedOn },
    { label: "Codice fiscale", value: association.taxCode },
    { label: "Sede legale", value: associationAddress },
  ];

  return (
    <main className="aurora-page">
      <header className="aurora-page-header">
        <Link href="/" className="aurora-page-brand">Insieme <em>Oltre</em></Link>
        <Link href="/" className="aurora-page-back">← Torna al sito</Link>
      </header>

      <article className="association">
        <header className="association-intro">
          <p className="association-kicker">Chi siamo</p>
          <h1>L’associazione</h1>
          <p className="association-lead">
            Insieme Oltre ODV nasce a Ischia il {association.foundedOn} dall’incontro di famiglie e persone che condividono un
            obiettivo semplice e concreto: costruire una comunità più inclusiva, capace di accompagnare ogni persona nelle
            diverse fasi della vita.
          </p>
        </header>

        <section className="association-section association-split" aria-labelledby="finalita">
          <div>
            <h2 id="finalita">Le nostre finalità</h2>
            <p>
              Ci rivolgiamo alle persone con trisomia 21 e altre disabilità intellettive o relazionali che vivono sull’isola
              d’Ischia, alle loro famiglie e a tutta la comunità. Lavoriamo per:
            </p>
          </div>
          <ul className="association-list">
            {purposes.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="association-section" aria-labelledby="attivita">
          <h2 id="attivita">Le attività previste dallo Statuto</h2>
          <p className="association-section-intro">
            L’associazione si propone di sviluppare, passo dopo passo e insieme alle famiglie, attività in questi ambiti.
          </p>
          <div className="association-activities">
            {activities.map((activity, index) => (
              <article className="association-activity" key={activity.title}>
                <span className="association-activity-number">{String(index + 1).padStart(2, "0")}</span>
                <h3>{activity.title}</h3>
                <p>{activity.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="association-section association-split" aria-labelledby="principi">
          <div>
            <h2 id="principi">Come vogliamo farlo</h2>
            <p>Non spazi separati, ma una comunità che si incontra. Lo Statuto indica alcuni principi:</p>
          </div>
          <ul className="association-list">
            {principles.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="association-section" aria-labelledby="direttivo">
          <h2 id="direttivo">Il Consiglio Direttivo</h2>
          <ul className="association-board">
            {board.map((member) => (
              <li key={member.name}>
                <span className="association-board-name">{member.name}</span>
                <span className="association-board-role">{member.role}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="association-section association-split association-closing">
          <section aria-labelledby="documenti">
            <h2 id="documenti">Documenti</h2>
            <p>
              Atto costitutivo e Statuto sono disponibili su richiesta, scrivendo a{" "}
              <a className="nowrap" href={`mailto:${association.email}`}>{association.email}</a>.
            </p>
          </section>
          <section aria-labelledby="dati">
            <h2 id="dati">Dati dell’associazione</h2>
            <dl className="association-details">
              {details.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
              <div>
                <dt>Email</dt>
                <dd><a href={`mailto:${association.email}`}>{association.email}</a></dd>
              </div>
            </dl>
          </section>
        </div>
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
