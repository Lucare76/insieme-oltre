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


/** Aggiunge l'offset solo quando l'ora locale individua un istante univoco. */
function romeDateTime(date: string, time: string) {
  const local = `${date}T${time}:00`;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const validOffsets = [1, 2].filter((offset) => {
    const parts = formatter.formatToParts(new Date(Date.UTC(year, month - 1, day, hour - offset, minute)));
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
    return `${value("year")}-${value("month")}-${value("day")}` === date &&
      `${value("hour")}:${value("minute")}` === time;
  });
  return validOffsets.length === 1 ? `${local}+0${validOffsets[0]}:00` : local;
}

/** Riconosce il comune solo se esplicitamente presente nei dati inseriti. */
function eventLocality(event: AssociationEvent) {
  const text = `${event.locationName} ${event.address}`.toLocaleLowerCase("it");
  const municipalities: [RegExp, string][] = [
    [/\bbarano\s+d['’]ischia\b|\bbarano\b/iu, "Barano d'Ischia"],
    [/\bcasamicciola(?:\s+terme)?\b/iu, "Casamicciola Terme"],
    [/\blacco\s+ameno\b/iu, "Lacco Ameno"],
    [/\bserrara\s+fontana\b/iu, "Serrara Fontana"],
    [/\bforio\b/iu, "Forio"],
  ];
  const matches = municipalities.filter(([pattern]) => pattern.test(text)).map(([, name]) => name);
  const withoutBarano = text.replace(/\bbarano\s+d['’]ischia\b/giu, "");
  if (/\bischia\b/iu.test(withoutBarano) && matches.length === 0) matches.push("Ischia");
  return matches.length === 1 ? matches[0] : undefined;
}

export function eventJsonLd(event: AssociationEvent) {
  const locality = eventLocality(event);
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.topicTitle ? `${event.topicTitle} — ${event.title}` : event.title,
    description: event.description || event.shortDescription,
    startDate: romeDateTime(event.eventDate, event.startTime),
    ...(event.endTime ? { endDate: romeDateTime(event.eventDate, event.endTime) } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.locationName,
      ...((event.address || locality) ? {
        address: {
          "@type": "PostalAddress",
          ...(event.address ? { streetAddress: event.address } : {}),
          ...(locality ? { addressLocality: locality } : {}),
          addressCountry: "IT",
        },
      } : {}),
    },
    organizer: { "@type": "Organization", name: "Insieme Oltre ODV", url: siteUrl },
    ...(event.performerName ? { performer: { "@type": "Person", name: event.performerName } } : {}),
    ...(event.freeAdmission ? { isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", url: `${siteUrl}${eventPath(event)}` } } : {}),
    ...(event.imagePath ? { image: [new URL(event.imagePath, siteUrl).href] } : {}),
    ...(event.externalUrl ? { sameAs: event.externalUrl } : {}),
    url: `${siteUrl}${eventPath(event)}`,
  };
}
