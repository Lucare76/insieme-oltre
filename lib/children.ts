// Modello unico per le card e le storie dei bambini: lo usano homepage, pagine storia, sitemap e admin.

export type ChildStoryStatus = "pubblicata" | "in_arrivo";

export type ChildStory = {
  id: string;
  name: string;
  /** Vuota = prima lettera del nome. */
  initial: string;
  /** Vuoto = "Io sono {nome}." */
  cardTitle: string;
  cardSubtitle: string;
  cardText: string;
  status: ChildStoryStatus;
  slug: string;
  storyTitle: string;
  /** Paragrafi separati da una riga vuota; un semplice a capo resta dentro il paragrafo. */
  storyText: string;
  /** Al massimo 3 percorsi in /public, tutti facoltativi. */
  photos: string[];
};

export const STORY_LINK_LABEL = "Conosci la mia storia →";
export const STORY_PENDING_LABEL = "Storia in arrivo";
export const STORY_ACCENTS = ["coral", "sage", "gold"] as const;
export type StoryAccent = (typeof STORY_ACCENTS)[number];

export const CHILD_LIMITS = {
  cardTitle: 28,
  cardSubtitle: 45,
  cardText: 220,
  storyTitle: 80,
  storyTextMin: 1500,
  storyTextMax: 3500,
  photos: 3,
} as const;

/** Bambini con una pagina impaginata a mano (app/storie/<slug>): il loro testo completo si modifica altrove. */
export const DEDICATED_STORY_PAGES = ["aurora"];

export const PHOTO_PATTERN = /^\/(?:storie\/)?[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const charCount = (text: string) => [...text].length;

export function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function childInitial(child: Pick<ChildStory, "initial" | "name">) {
  return (child.initial.trim() || child.name.trim().charAt(0)).toUpperCase();
}

export function childCardTitle(child: Pick<ChildStory, "cardTitle" | "name">) {
  return child.cardTitle.trim() || `Io sono ${child.name.trim()}.`;
}

export function childAccent(index: number): StoryAccent {
  return STORY_ACCENTS[index % STORY_ACCENTS.length];
}

export function hasDedicatedPage(child: Pick<ChildStory, "slug">) {
  return DEDICATED_STORY_PAGES.includes(child.slug);
}

export function isPublished(child: ChildStory) {
  return child.status === "pubblicata" && SLUG_PATTERN.test(child.slug);
}

export function storyParagraphs(text: string) {
  return text.replace(/\r/g, "").split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

export function newChild(name = ""): ChildStory {
  return {
    id: `child-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    initial: "",
    cardTitle: "",
    cardSubtitle: "La mia storia arriverà presto.",
    cardText: "Presto, raccontato dalla sua famiglia.",
    status: "in_arrivo",
    slug: slugify(name),
    storyTitle: "",
    storyText: "",
    photos: [],
  };
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** Ripulisce dati arrivati da Supabase o dall'admin. Restituisce null se non è un elenco. */
export function normalizeChildren(input: unknown): ChildStory[] | null {
  if (!Array.isArray(input)) return null;

  return input
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item, index) => ({
      id: text(item.id) || `child-${index}`,
      name: text(item.name),
      initial: text(item.initial).slice(0, 2),
      cardTitle: text(item.cardTitle),
      cardSubtitle: text(item.cardSubtitle),
      cardText: text(item.cardText),
      status: item.status === "pubblicata" ? "pubblicata" : "in_arrivo",
      slug: text(item.slug).trim(),
      storyTitle: text(item.storyTitle),
      storyText: text(item.storyText),
      photos: (Array.isArray(item.photos) ? item.photos : [])
        .map(text)
        .map((photo) => photo.trim())
        .filter(Boolean)
        .slice(0, CHILD_LIMITS.photos),
    }));
}

export type ChildIssue = {
  field: keyof ChildStory;
  level: "error" | "warning";
  message: string;
};

/** Errori (bloccano il salvataggio) e avvisi (limiti consigliati) per un bambino. */
export function childIssues(child: ChildStory, all: ChildStory[]): ChildIssue[] {
  const issues: ChildIssue[] = [];
  const add = (field: keyof ChildStory, level: ChildIssue["level"], message: string) => issues.push({ field, level, message });
  const over = (field: keyof ChildStory, value: string, max: number, label: string) => {
    const count = charCount(value);
    if (count > max) add(field, "warning", `${label}: ${count} caratteri, il massimo consigliato è ${max}.`);
  };

  if (!child.name.trim()) add("name", "error", "Il nome è obbligatorio.");
  over("cardTitle", childCardTitle(child), CHILD_LIMITS.cardTitle, "Titolo card");
  over("cardSubtitle", child.cardSubtitle, CHILD_LIMITS.cardSubtitle, "Sottotitolo card");
  over("cardText", child.cardText, CHILD_LIMITS.cardText, "Testo introduttivo");
  over("storyTitle", child.storyTitle, CHILD_LIMITS.storyTitle, "Titolo pagina storia");

  // Una storia "in arrivo" non ha pagina pubblica: slug, testo e foto non bloccano mai il salvataggio.
  // Diventano obbligatori (errori) solo quando la storia è "pubblicata".
  const published = child.status === "pubblicata";
  const required: ChildIssue["level"] = published ? "error" : "warning";

  if (published && !child.slug) add("slug", "error", "Per pubblicare la storia serve lo slug della pagina (es. «alessandro»).");
  if (child.slug && !SLUG_PATTERN.test(child.slug)) {
    add("slug", required, "Lo slug può contenere solo lettere minuscole, numeri e trattini (es. «alessandro»).");
  } else if (child.slug && all.some((other) => other !== child && other.slug === child.slug)) {
    add("slug", required, `Lo slug «${child.slug}» è già usato da un altro bambino.`);
  }

  if (published && !hasDedicatedPage(child)) {
    if (!child.storyTitle.trim()) add("storyTitle", "error", "Per pubblicare la storia serve il titolo della pagina.");
    const count = charCount(child.storyText.trim());
    if (!count) add("storyText", "error", "Per pubblicare la storia serve il testo completo.");
    else if (count < CHILD_LIMITS.storyTextMin || count > CHILD_LIMITS.storyTextMax) {
      add("storyText", "warning", `Testo completo: ${count} caratteri, consigliati tra ${CHILD_LIMITS.storyTextMin} e ${CHILD_LIMITS.storyTextMax}.`);
    }
  }

  if (child.photos.length > CHILD_LIMITS.photos) add("photos", required, `Al massimo ${CHILD_LIMITS.photos} foto.`);
  child.photos.forEach((photo, index) => {
    if (photo.trim() && !PHOTO_PATTERN.test(photo.trim())) {
      add("photos", required, `Foto ${index + 1}: usa un percorso come /nome-storia.jpg (jpg, png o webp).`);
    }
  });

  return issues;
}
