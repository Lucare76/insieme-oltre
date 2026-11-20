import Image from "next/image";
import { eventDateParts, formatEventDate, formatEventTime, type AssociationEvent } from "../../lib/events";

export function EventCard({ event, compact = false }: { event: AssociationEvent; compact?: boolean }) {
  const date = eventDateParts(event.eventDate);
  return (
    <article className={"event-card" + (compact ? " event-card-compact" : "")}>
      <div className="event-date-block" aria-label={formatEventDate(event.eventDate)}>
        <span>{date.weekday}</span><strong>{date.day}</strong><em>{date.month}</em>
      </div>
      {event.imagePath && <div className="event-poster"><Image src={event.imagePath} alt={event.title + " — locandina"} fill sizes={compact ? "(max-width: 760px) 90vw, 300px" : "(max-width: 760px) 90vw, 360px"} /></div>}
      <div className="event-card-copy">
        <p className="event-meta">{formatEventTime(event)} · {event.locationName}</p>
        <h3>{event.title}</h3>
        <p>{event.shortDescription}</p>
        {!compact && event.description && <p className="event-description">{event.description}</p>}
        {event.address && <p className="event-address">{event.address}</p>}
        <div className="event-actions">
          {event.externalUrl && <a className="button button-primary" href={event.externalUrl} target="_blank" rel="noreferrer">{event.linkLabel || "Scopri di più"} <span aria-hidden="true">↗</span></a>}
          {compact && <a className="event-more" href="/appuntamenti">Tutti gli appuntamenti →</a>}
        </div>
      </div>
    </article>
  );
}
