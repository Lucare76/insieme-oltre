export type AssociationEvent = {
  id: string;
  slug: string;
  title: string;
  topicTitle: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  locationName: string;
  address: string;
  shortDescription: string;
  description: string;
  imagePath: string;
  externalUrl: string;
  linkLabel: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

const italianMonths = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

export function eventSlug(title: string, date: string): string {
  const titlePart = title.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70).replace(/-$/g, "") || "appuntamento";
  const [year, month, day] = date.split("-").map(Number);
  return `${titlePart}-${day}-${italianMonths[month - 1] || "evento"}-${year}`;
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function normalizeEvents(value: unknown): AssociationEvent[] {
  if (!Array.isArray(value)) return [];
  const result: AssociationEvent[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const eventDate = clean(raw.eventDate, 10);
    const startTime = clean(raw.startTime, 5);
    const endTime = clean(raw.endTime, 5);
    const title = clean(raw.title, 120);
    const locationName = clean(raw.locationName, 140);
    // Compatibilita con l'evento gia pubblicato prima dell'introduzione del tema.
    const topicTitle = clean(raw.topicTitle, 120) ||
      (title === "Uno spazio per ascoltarci" && eventDate === "2026-11-22"
        ? "Giornata dei nostri bambini" : "");
    const shortDescription = clean(raw.shortDescription, 320);
    const externalUrl = clean(raw.externalUrl, 500);
    if (
      !title ||
      !locationName ||
      !shortDescription ||
      !datePattern.test(eventDate) ||
      !timePattern.test(startTime) ||
      (endTime && !timePattern.test(endTime)) ||
      (endTime && endTime < startTime) ||
      !validUrl(externalUrl)
    ) continue;

    result.push({
      id: clean(raw.id, 80) || crypto.randomUUID(),
      slug: clean(raw.slug, 150) || eventSlug(topicTitle || title, eventDate),
      title,
      topicTitle,
      eventDate,
      startTime,
      endTime,
      locationName,
      address: clean(raw.address, 220),
      shortDescription,
      description: clean(raw.description, 4000),
      imagePath: clean(raw.imagePath, 500),
      externalUrl,
      linkLabel: clean(raw.linkLabel, 80),
      published: raw.published === true,
      createdAt: clean(raw.createdAt, 40) || new Date().toISOString(),
      updatedAt: clean(raw.updatedAt, 40) || new Date().toISOString(),
    });
  }
  // In caso di due eventi con lo stesso nome e data, assegna a entrambi
  // un suffisso stabile. L’UUID completo non viene mai mostrato nell’URL.
  const counts = new Map<string, number>();
  for (const event of result) counts.set(event.slug, (counts.get(event.slug) || 0) + 1);
  for (const event of result) {
    if ((counts.get(event.slug) || 0) > 1) {
      event.slug = `${event.slug}-${event.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase()}`;
    }
  }
  return result.sort((a, b) =>
    (a.eventDate + a.startTime).localeCompare(b.eventDate + b.startTime),
  );
}

export function validateEvents(value: unknown) {
  if (!Array.isArray(value)) return "Elenco appuntamenti non valido.";
  if (value.length > 100) return "Puoi gestire al massimo 100 appuntamenti.";
  const normalized = normalizeEvents(value);
  if (normalized.length !== value.length)
    return "Controlla titolo, data, orari, luogo, descrizione e link degli appuntamenti.";
  const ids = new Set(normalized.map((event) => event.id));
  if (ids.size !== normalized.length) return "Due appuntamenti hanno lo stesso identificativo.";
  return null;
}

function romeNowKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function eventStartKey(event: AssociationEvent) {
  return `${event.eventDate}T${event.startTime}`;
}

export function eventEndKey(event: AssociationEvent) {
  return `${event.eventDate}T${event.endTime || "23:59"}`;
}

export function splitEvents(events: AssociationEvent[], now = new Date()) {
  const key = romeNowKey(now);
  const published = events.filter((event) => event.published);
  const upcoming = published
    .filter((event) => eventEndKey(event) >= key)
    .sort((a, b) => eventStartKey(a).localeCompare(eventStartKey(b)));
  const past = published
    .filter((event) => eventEndKey(event) < key)
    .sort((a, b) => eventStartKey(b).localeCompare(eventStartKey(a)));
  return { upcoming, past };
}

export function formatEventDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function eventDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return {
    day: new Intl.DateTimeFormat("it-IT", { day: "2-digit", timeZone: "Europe/Rome" }).format(date),
    month: new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: "Europe/Rome" }).format(date).replace(".", ""),
    weekday: new Intl.DateTimeFormat("it-IT", { weekday: "long", timeZone: "Europe/Rome" }).format(date),
  };
}

export function formatEventTime(event: AssociationEvent) {
  return event.endTime ? `${event.startTime} – ${event.endTime}` : event.startTime;
}

export async function getAssociationEvents(): Promise<AssociationEvent[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const response = await fetch(
      `${url}/rest/v1/site_content?key=eq.events&select=value,updated_at&order=updated_at.desc&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      },
    );
    if (!response.ok) return [];
    const rows = (await response.json()) as { value?: unknown }[];
    return normalizeEvents(rows[0]?.value);
  } catch {
    return [];
  }
}
