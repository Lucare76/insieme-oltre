/** Un questionario di priorità, non un modulo sanitario o di iscrizione. */
export const roles = [
  { value: "familiare", label: "Genitore o familiare" },
  { value: "persona", label: "Persona con sindrome di Down" },
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

export type Participation = {
  role: (typeof roles)[number]["value"];
  age: (typeof ages)[number]["value"];
  interests: (typeof priorities)[number]["value"][];
  idea: string | null;
};

export function validateParticipation(value: unknown): Participation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const role = roles.find((x) => x.value === v.role)?.value;
  const age = ages.find((x) => x.value === v.age)?.value;
  if (!role || !age || !Array.isArray(v.interests) || v.interests.length < 1 || v.interests.length > 3) return null;
  if (new Set(v.interests).size !== v.interests.length) return null;
  if (!v.interests.every((i) => typeof i === "string" && priorities.some((p) => p.value === i))) return null;
  if (v.idea !== undefined && v.idea !== null && typeof v.idea !== "string") return null;
  const idea = typeof v.idea === "string" ? v.idea.trim() : "";
  if (idea.length > 350) return null;
  if (v.privacy !== true) return null;
  return { role, age, interests: v.interests as Participation["interests"], idea: idea || null };
}
