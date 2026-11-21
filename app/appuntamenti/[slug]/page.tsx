import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { formatEventDate, formatEventTime, splitEvents } from "../../../lib/events";
import { LegalLinks } from "../../components/LegalLinks";
import { InstitutionalLine } from "../../components/InstitutionalLine";
import { getAssociationEvents } from "../../../lib/events";
import { eventJsonLd, eventPath, findPublicEvent } from "../../../lib/eventPages";
import { socialMetadata } from "../../../lib/seo";
import "../../events.css";

type Props = { params: Promise<{ slug: string }> };

async function loadEvent(slug: string) {
  return findPublicEvent(await getAssociationEvents(), slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await loadEvent((await params).slug);
  if (!event) return { robots: { index: false, follow: false } };
  const path = eventPath(event);
  const description = event.shortDescription;
  const displayTitle = event.topicTitle || event.title;
  const fullTitle = event.topicTitle ? `${event.topicTitle} | ${event.title}` : event.title;
  return {
    title: `${fullTitle} | Insieme Oltre Ischia`,
    description,
    alternates: { canonical: path },
    ...socialMetadata({
      title: `${fullTitle} | Insieme Oltre`,
      description,
      path,
      ...(event.imagePath ? { image: { url: event.imagePath, alt: event.title } } : {}),
    }),
  };
}

export default async function EventoPage({ params }: Props) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) notFound();
  if (slug !== eventPath(event).split("/").pop()) permanentRedirect(eventPath(event));

  const isPast = splitEvents([event]).past.length > 0;
  const paragraphs = event.description.split(/\n\s*\n/).map((line) => line.trim()).filter(Boolean);
  return (
    <main className="events-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd(event)).replace(/</g, "\\u003c") }}
      />
      <div className="events-page-inner">
        <header className="events-page-header">
          <Link href="/appuntamenti" className="section-kicker">← Tutti gli appuntamenti</Link>
          {event.topicTitle && <p className="section-kicker">{event.title}</p>}
          <h1>{event.topicTitle || event.title}</h1>
          <p className="events-page-intro">{event.shortDescription}</p>
        </header>
        <div className="event-detail-grid">
          <article className="event-detail-content">
            {event.imagePath && <div className="event-detail-image"><Image src={event.imagePath} alt={event.title + " — locandina"} fill sizes="(max-width: 760px) 90vw, 700px"/></div>}
            <p className="section-kicker">{isPast ? "Un ricordo condiviso" : "Ti aspettiamo"}</p>
            <h2>Un momento da vivere insieme</h2>
            {paragraphs.length ? paragraphs.map((paragraph, index) => <p key={index} className="event-detail-paragraph">{paragraph}</p>) : <p className="event-detail-paragraph">{event.shortDescription}</p>}
          </article>
          <aside className="event-detail-info" aria-label="Informazioni sull’appuntamento">
            <h2>Informazioni utili</h2>
            <dl>
              <div><dt>Quando</dt><dd>{formatEventDate(event.eventDate)}</dd></div>
              <div><dt>Orario</dt><dd>{formatEventTime(event)}</dd></div>
              <div><dt>Dove</dt><dd>{event.locationName}</dd></div>
              {event.address && <div><dt>Indirizzo</dt><dd>{event.address}</dd></div>}
            </dl>
            {event.externalUrl && <a className="button button-primary" href={event.externalUrl} target="_blank" rel="noopener noreferrer">{event.linkLabel || "Maggiori informazioni"} ↗</a>}
            <p className="event-detail-association">Un’iniziativa di Insieme Oltre ODV, per incontrarci e costruire una comunità più inclusiva.</p>
          </aside>
        </div>
        <p className="event-detail-back"><Link href="/appuntamenti">← Torna a tutti gli appuntamenti</Link></p>
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
