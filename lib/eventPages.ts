import type { AssociationEvent } from "./events";
import { siteUrl } from "./siteUrl";

/** Il nuovo URL non espone l'UUID, ma la chiave interna rimane invariata. */
export function eventPath(event: AssociationEvent): string {
  return `/appuntamenti/${encodeURIComponent(event.slug)}`;
}

/** Supporta anche i vecchi link con UUID: la pagina li redirige al canonical. */
export function findPublicEvent(events: AssociationEvent[], slug: string) {
  return events.find((event) =>
    event.published && (
      event.slug === slug ||
      slug.endsWith(`--${encodeURIComponent(event.id)}`)
    )
  );
}

export function eventJsonLd(event: AssociationEvent) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.topicTitle ? `${event.topicTitle} — ${event.title}` : event.title,
    description: event.description || event.shortDescription,
    startDate: `${event.eventDate}T${event.startTime}:00`,
    ...(event.endTime ? { endDate: `${event.eventDate}T${event.endTime}:00` } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: event.locationName,
      ...(event.address ? { address: event.address } : {}) },
    organizer: { "@type": "Organization", name: "Insieme Oltre ODV", url: siteUrl },
    ...(event.imagePath ? { image: [new URL(event.imagePath, siteUrl).href] } : {}),
    ...(event.externalUrl ? { sameAs: event.externalUrl } : {}),
    url: `${siteUrl}${eventPath(event)}`,
  };
}
