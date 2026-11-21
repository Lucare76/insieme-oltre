import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { EventCard } from "../../components/EventCard";
import { LegalLinks } from "../../components/LegalLinks";
import { InstitutionalLine } from "../../components/InstitutionalLine";
import { getAssociationEvents } from "../../../lib/events";
import { eventJsonLd, eventPath, findPublicEvent } from "../../../lib/eventPages";
import { socialMetadata } from "../../../lib/seo";
import ".././../../events.css";

type Props = { params: Promise<{ slug: string }> };

async function loadEvent(slug: string) {
  return findPublicEvent(await getAssociationEvents(), slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await loadEvent((await params).slug);
  if (!event) return { robots: { index: false, follow: false } };
  const path = eventPath(event);
  const description = event.shortDescription;
  return {
    title: `${event.title} | Appuntamenti Insieme Oltre Ischia`,
    description,
    alternates: { canonical: path },
    ...socialMetadata({
      title: `${event.title} | Insieme Oltre`,
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

  return (
    <main className="events-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd(event)).replace(/</g, "\\u003c") }}
      />
      <div className="events-page-inner">
        <header className="events-page-header">
          <Link href="/appuntamenti" className="section-kicker">← Tutti gli appuntamenti</Link>
          <h1>{event.title}</h1>
          <p className="events-page-intro">{event.shortDescription}</p>
        </header>
        <div className="events-list"><EventCard event={event} /></div>
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
