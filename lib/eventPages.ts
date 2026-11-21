import type { AssociationEvent } from "./events";
import { siteUrl } from "./siteUrl";

/** Human-readable path, with immutable event ID to keep old shared URLs resolvable. */
export function eventPath(event: AssociationEvent): string {
  const title = event.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 75).replace(/-$/g, "");
  return `/appuntamenti/${title || "evento"}--${encodeURIComponent(event.id)}`;
}

/** Accept an old title slug as long as the original event ID still exists. */
export function findPublicEvent(events: AssociationEvent[], slug: string) {
  return events.find((event) =>
    event.published && slug.endsWith(`--${encodeURIComponent(event.id)}`)
  );
}

export function eventJsonLd(event: AssociationEvent) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
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
