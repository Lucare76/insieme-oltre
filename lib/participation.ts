/** Questionario di priorità: nessuna iscrizione, nessun nome o recapito richiesto. */
export const roles = [
  { value: "familiare", label: "Genitore o familiare" },
  { value: "persona", label: "Partecipo in prima persona" },
  { value: "volontario", label: "Volontario o sostenitore" },
] as const;

export const ages = [
  { value: "infanzia", label: "Bambini" },
  { value: "giovani", label: "Adolescenti e giovani" },
  { value: "adulti", label: "Adulti" },
  { value: "tutte", label: "Tutte le età" },
] as const;

export const priorities = [
  { value: "famiglie", title: "Incontri tra famiglie", detail: "Confronto, ascolto e orientamento." },
  { value: "laboratori", title: "Laboratori creativi", detail: "Cucina, musica, arte e movimento." },
  { value: "autonomia", title: "Autonomia quotidiana", detail: "Spesa, denaro, spostamenti e scelte." },
  { value: "sport", title: "Sport e tempo libero", detail: "Uscite, amicizie e attività inclusive." },
  { value: "lavoro", title: "Formazione e lavoro", detail: "Collaborazioni con le realtà del territorio." },
  { value: "digitale", title: "Strumenti digitali", detail: "Guide, calendario e supporti pratici." },
] as const;

export const needs = [
  { value: "servizi", label: "Orientarmi tra servizi e diritti" },
  { value: "attivita", label: "Trovare attività inclusive" },
  { value: "autonomia", label: "Sostenere l'autonomia quotidiana" },
  { value: "relazioni", label: "Creare amicizie e relazioni" },
  { value: "futuro", label: "Costruire opportunità per il futuro" },
] as const;

export const times = [
  { value: "mattina", label: "Mattina" },
  { value: "pomeriggio", label: "Pomeriggio" },
  { value: "sera", label: "Sera" },
  { value: "weekend", label: "Fine settimana" },
] as const;

export const obstacles = [
  { value: "trasporti", label: "Spostamenti e trasporti" },
  { value: "orari", label: "Orari poco compatibili" },
  { value: "costi", label: "Costi delle attività" },
  { value: "accessibilita", label: "Accessibilità degli spazi" },
  { value: "nessuno", label: "Nessuna difficoltà particolare" },
] as const;

export const contributions = [
  { value: "volontario", label: "Come volontario/a" },
  { value: "competenze", label: "Con le mie competenze professionali" },
  { value: "saltuario", label: "Aiutando quando posso" },
  { value: "partecipante", label: "Preferisco partecipare alle attività" },
  { value: "incerto", label: "Non lo so ancora" },
] as const;

type Value<T extends readonly { value: string }[]> = T[number]["value"];
export type Participation = {
  role: Value<typeof roles>;
  age: Value<typeof ages>;
  interests: Value<typeof priorities>[];
  need: Value<typeof needs> | null;
  times: Value<typeof times>[];
  obstacle: Value<typeof obstacles> | null;
  contribution: Value<typeof contributions> | null;
  idea: string | null;
};

function optionalValue<T extends readonly { value: string }[]>(value: unknown, options: T): Value<T> | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  return options.find((x) => x.value === value)?.value;
}

export function validateParticipation(value: unknown): Participation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const role = roles.find((x) => x.value === v.role)?.value;
  const age = ages.find((x) => x.value === v.age)?.value;
  if (!role || !age || !Array.isArray(v.interests) || v.interests.length < 1 || v.interests.length > 3) return null;
  if (new Set(v.interests).size !== v.interests.length) return null;
  if (!v.interests.every((i) => typeof i === "string" && priorities.some((p) => p.value === i))) return null;
  const need = optionalValue(v.need, needs);
  const obstacle = optionalValue(v.obstacle, obstacles);
  const contribution = optionalValue(v.contribution, contributions);
  if (need === undefined || obstacle === undefined || contribution === undefined) return null;
  const selectedTimes = v.times ?? [];
  if (!Array.isArray(selectedTimes) || selectedTimes.length > 2 || new Set(selectedTimes).size !== selectedTimes.length) return null;
  if (!selectedTimes.every((t) => typeof t === "string" && times.some((item) => item.value === t))) return null;
  if (v.idea !== undefined && v.idea !== null && typeof v.idea !== "string") return null;
  const idea = typeof v.idea === "string" ? v.idea.trim() : "";
  if (idea.length > 350 || v.privacy !== true) return null;
  return {
    role,
    age,
    interests: v.interests as Participation["interests"],
    need,
    times: selectedTimes as Participation["times"],
    obstacle,
    contribution,
    idea: idea || null,
  };
}
