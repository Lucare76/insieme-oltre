import type { Movement } from "./accounting";
export type MovementFilters = {
  year: string;
  project: string;
  account: string;
  category: string;
  kind: string;
  search: string;
  showCancelled: boolean;
};
export const defaultMovementFilters: MovementFilters = {
  year: "",
  project: "",
  account: "",
  category: "",
  kind: "",
  search: "",
  showCancelled: false,
};
// Criteri del registro e del CSV: i trasferimenti restano visibili con
// qualunque conto selezionato, gli annullati solo se richiesti.
export function filterMovements<T extends Movement>(
  items: T[],
  f: MovementFilters,
): T[] {
  return items.filter(
    (x) =>
      (!f.year || x.date.startsWith(f.year)) &&
      (!f.project || x.project === f.project) &&
      (!f.account || x.account === f.account || x.kind === "transfer") &&
      (!f.category || x.category === f.category) &&
      (!f.kind || x.kind === f.kind) &&
      (f.showCancelled || !x.cancelled) &&
      `${x.description} ${x.category} ${x.project}`
        .toLowerCase()
        .includes(f.search.toLowerCase()),
  );
}
export const extraFilterKeys = [
  "project",
  "kind",
  "category",
  "showCancelled",
] as const;
export function activeExtraFilters(f: MovementFilters) {
  return extraFilterKeys.filter((k) => f[k] !== defaultMovementFilters[k]);
}
export function hasActiveFilters(f: MovementFilters) {
  return (Object.keys(defaultMovementFilters) as (keyof MovementFilters)[]).some(
    (k) => f[k] !== defaultMovementFilters[k],
  );
}
export const movementsLabel = (n: number) =>
  `${n} ${n === 1 ? "movimento" : "movimenti"}`;
