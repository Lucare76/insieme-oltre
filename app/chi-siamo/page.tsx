import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { InstitutionalLine } from "../components/InstitutionalLine";
import { LegalLinks } from "../components/LegalLinks";
import { socialMetadata, organizationJsonLd } from "../../lib/seo";
import { siteUrl } from "../../lib/siteUrl";
import "./about.css";

const title = "Chi siamo: famiglie e inclusione a Ischia | Insieme Oltre";
const description = "Conosci Insieme Oltre ODV: famiglie a Ischia che costruiscono relazioni e possibilità per persone con sindrome di Down e altre disabilità intellettive o relazionali.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/chi-siamo" },
  ...socialMetadata({ title, description, path: "/chi-siamo" }),
};

const directions = [
  { number: "01", title: "Famiglie e ascolto", text: "Creare occasioni di confronto fra famiglie, per condividere domande, esperienze e bisogni. Il primo passo è conoscerci e capire insieme quali priorità affrontare." },
  { number: "02", title: "Autonomia e scelte", text: "Costruire opportunità per sviluppare le autonomie quotidiane e valorizzare interessi e capacità, rispettando i tempi, i desideri e le scelte di ogni persona." },
  { number: "03", title: "Cultura e relazioni", text: "Immaginare laboratori e momenti condivisi, aperti a persone con e senza disabilità. Arte, musica e creatività possono diventare occasioni per incontrarsi e conoscersi." },
  { number: "04", title: "Tempo libero e futuro", text: "Promuovere relazioni attraverso sport e tempo libero e costruire un dialogo con scuole, realtà sociali e attività del territorio, anche sulle possibilità della vita adulta e del lavoro." },
];

export default function AboutPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { ...organizationJsonLd, "@id": `${siteUrl}/#organization` },
      { "@type": "AboutPage", "@id": `${siteUrl}/chi-siamo#webpage`, url: `${siteUrl}/chi-siamo`, name: title, description, inLanguage: "it-IT", about: { "@id": `${siteUrl}/#organization` } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Chi siamo", item: `${siteUrl}/chi-siamo` },
      ] },
    ],
  };

  return (
    <main className="about-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Insieme Oltre, homepage"><span className="brand-dot" aria-hidden="true">♥</span><span>Insieme <em>Oltre</em></span></Link>
        <nav aria-label="Navigazione principale"><Link href="/chi-siamo" aria-current="page">Chi siamo</Link><Link href="/#cosa-facciamo">Il progetto</Link><Link href="/#storie">Le storie</Link></nav>
        <Link className="header-cta" href="/#unisciti">Parla con noi</Link>
      </header>

      <div className="about-wrap">
        <nav className="about-breadcrumb" aria-label="Percorso di navigazione"><Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Chi siamo</span></nav>
        <section className="about-intro" aria-labelledby="about-title">
          <div>
            <p className="section-kicker">Insieme Oltre ODV · Ischia</p>
            <h1 id="about-title">Prima di tutto,<br /><em>persone.</em></h1>
            <p className="about-lead">Siamo un’associazione di famiglie a Ischia, accanto alle persone con sindrome di Down (trisomia 21) e altre disabilità intellettive o relazionali.</p>
            <p className="about-intro-note">Ci unisce il desiderio di costruire una comunità in cui ciascuno possa trovare relazioni, possibilità e il proprio posto nel mondo.</p>
          </div>
          <div className="about-logo-card"><Image src="/insieme-oltre-logo.png" alt="Insieme Oltre — L’amore non si misura in cromosomi" width={1448} height={1086} sizes="(max-width: 760px) 90vw, 36vw" className="about-logo" /></div>
        </section>

        <section className="about-story" aria-labelledby="about-origin">
          <p className="section-kicker">Da dove partiamo</p>
          <div className="about-story-grid">
            <h2 id="about-origin">Nessuna famiglia<br /><em>da sola.</em></h2>
            <div className="about-prose">
              <p>Insieme Oltre nasce dal bisogno di incontrare altre famiglie che possano capire, ascoltare e condividere le domande sul presente e sul futuro dei propri figli, piccoli e grandi.</p>
              <p>Una diagnosi non racconta una persona. Ci sono caratteri, passioni, amicizie, desideri e modi diversi di affrontare il mondo. Vogliamo partire da qui: dalla vita di ciascuno, senza ridurla a un’etichetta o a un’aspettativa uguale per tutti.</p>
              <p>Il nostro orizzonte è l’isola d’Ischia. Vogliamo costruire legami con famiglie, scuole, professionisti, associazioni, istituzioni e attività locali. Perché l’inclusione prende forma nei luoghi che abitiamo ogni giorno, quando possiamo partecipare e scegliere insieme agli altri.</p>
              <Link className="about-inline-link" href="/#storie">Incontra le persone attraverso le loro storie <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>

        <section className="about-directions" aria-labelledby="about-project">
          <p className="section-kicker">Il progetto che stiamo costruendo</p>
          <h2 id="about-project">Dall’ascolto,<br /><em>alle possibilità.</em></h2>
          <p className="about-section-lead">Queste sono le direzioni in cui vogliamo lavorare. Sono obiettivi da sviluppare con le persone del territorio: non un elenco di servizi già attivi.</p>
          <div className="about-card-grid">{directions.map((item) => <article className="about-direction" key={item.number}><span className="about-number" aria-hidden="true">{item.number}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
          <div className="about-listening"><p>Da quale bisogno cominciamo? Le risposte delle famiglie e delle persone interessate ci aiutano a scegliere le prime attività.</p><Link href="/partecipa" className="about-inline-link">Condividi le tue idee nel questionario <span aria-hidden="true">→</span></Link></div>
        </section>

        <section className="about-contact" aria-labelledby="about-join">
          <p className="section-kicker">Un passo, insieme</p>
          <h2 id="about-join">C’è spazio anche<br /><em>per la tua voce.</em></h2>
          <p>Se sei una famiglia, vuoi dare una mano o mettere a disposizione le tue competenze, puoi presentarti e raccontarci cosa ti piacerebbe costruire insieme. Anche una proposta può essere l’inizio di una relazione.</p>
          <div className="about-actions"><Link className="button button-primary" href="/#unisciti">Scrivici <span aria-hidden="true">→</span></Link><a className="about-inline-link" href="mailto:info@insiemeoltreischia.it">info@insiemeoltreischia.it</a></div>
        </section>
      </div>
      <footer className="about-footer"><div><Link className="about-footer-brand" href="/">Insieme <em>Oltre</em></Link><p>L’amore non si misura in cromosomi.</p><InstitutionalLine className="footer-institutional" /></div><div><Link href="/">Torna alla homepage ↑</Link><LegalLinks className="footer-legal" /></div></footer>
    </main>
  );
}
