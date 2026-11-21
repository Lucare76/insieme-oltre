import type { Metadata } from "next";
import Link from "next/link";
import { EventCard } from "../components/EventCard";
import { LegalLinks } from "../components/LegalLinks";
import { InstitutionalLine } from "../components/InstitutionalLine";
import { getAssociationEvents, splitEvents } from "../../lib/events";
import { socialMetadata } from "../../lib/seo";
import { eventJsonLd } from "../../lib/eventPages";
import "../events.css";

export const metadata: Metadata = {
  title: "Appuntamenti | Insieme Oltre ODV Ischia",
  description: "Scopri i prossimi appuntamenti di Insieme Oltre ODV a Ischia: incontri, attività e momenti per famiglie, ragazzi, volontari e comunità.",
  alternates: { canonical: "/appuntamenti" },
  ...socialMetadata({
    title: "Appuntamenti | Insieme Oltre ODV Ischia",
    description: "Scopri i prossimi appuntamenti di Insieme Oltre ODV a Ischia: incontri, attività e momenti per famiglie, ragazzi, volontari e comunità.",
    path: "/appuntamenti",
  }),
};

export default async function AppuntamentiPage() {
  const { upcoming, past } = splitEvents(await getAssociationEvents());
  const structuredEvents = upcoming.map(eventJsonLd);
  return (
    <main className="events-page">
      {structuredEvents.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": structuredEvents,
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <div className="events-page-inner">
        <header className="events-page-header">
          <Link href="/" className="section-kicker">← Insieme Oltre</Link>
          <h1>I nostri appuntamenti</h1>
          <p className="events-page-intro">Momenti per incontrarci, conoscerci e costruire insieme qualcosa di bello. Qui trovi i prossimi appuntamenti di Insieme Oltre.</p>
        </header>

        <section aria-labelledby="future-events-title">
          <p className="section-kicker">Prossimamente</p>
          <h2 id="future-events-title" className="sr-only">Prossimi appuntamenti</h2>
          {upcoming.length ? <div className="events-list">{upcoming.map((event) => <EventCard key={event.id} event={event}/>)}</div> : <p className="events-empty">Stiamo preparando i prossimi appuntamenti. Torna a trovarci presto.</p>}
        </section>

        {past.length > 0 && <section className="events-archive" aria-labelledby="past-events-title">
          <p className="section-kicker">Ricordi condivisi</p>
          <h2 id="past-events-title">Gli appuntamenti passati</h2>
          <div className="events-list">{past.map((event) => <EventCard key={event.id} event={event}/>)}</div>
        </section>}
      </div>
      <footer>
        <div className="footer-brand">
          <span>Insieme <em>Oltre</em></span>
          <LegalLinks className="footer-legal"/>
          <InstitutionalLine className="footer-institutional"/>
        </div>
        <p>L’amore non si misura in cromosomi.</p>
        <Link href="/">Torna alla home</Link>
      </footer>
    </main>
  );
}
