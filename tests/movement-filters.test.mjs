import { test } from "node:test";
import assert from "node:assert/strict";
import { balances } from "../lib/accounting.ts";
import {
  activeExtraFilters,
  defaultMovementFilters,
  filterMovements,
  hasActiveFilters,
  movementsLabel,
} from "../lib/movementFilters.ts";
// Copia del filtro che era inline in app/admin/page.tsx prima del refactoring.
const original = (items, f) =>
  items.filter(
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
const items = [];
let n = 0;
for (const date of ["2025-03-01", "2026-10-20"])
  for (const kind of ["income", "expense", "transfer", "opening"])
    for (const account of ["cash", "bank"])
      for (const cancelled of [false, true])
        items.push({
          id: String(n++),
          date,
          kind,
          account,
          cancelled,
          amount_cents: 100 + n * 7,
          category: n % 2 ? "Donazioni" : "Materiali",
          project: n % 3 ? "Natale" : "",
          description: n % 4 ? "Laboratorio" : "Quota",
          version: 1,
          cancellation_reason: cancelled ? "Errore" : null,
        });
test("il filtro estratto coincide con quello originale su ogni combinazione", () => {
  let combos = 0;
  for (const year of ["", "2026", "2025"])
    for (const project of ["", "Natale"])
      for (const account of ["", "cash", "bank"])
        for (const category of ["", "Materiali"])
          for (const kind of ["", "income", "expense", "transfer", "opening"])
            for (const search of ["", "LAB", "natale", "zzz"])
              for (const showCancelled of [false, true]) {
                const f = { year, project, account, category, kind, search, showCancelled };
                const a = filterMovements(items, f);
                assert.deepEqual(a, original(items, f));
                assert.deepEqual(balances(a), balances(original(items, f)));
                combos++;
              }
  assert.equal(combos, 1440);
});
test("conteggio dei filtri aggiuntivi e stato di azzeramento", () => {
  assert.deepEqual(activeExtraFilters(defaultMovementFilters), []);
  assert.equal(hasActiveFilters(defaultMovementFilters), false);
  const base = { ...defaultMovementFilters, year: "2026", search: "x" };
  assert.deepEqual(activeExtraFilters(base), []);
  assert.equal(hasActiveFilters(base), true);
  assert.equal(hasActiveFilters({ ...defaultMovementFilters, account: "cash" }), true);
  const extra = { ...defaultMovementFilters, project: "Natale", kind: "expense", showCancelled: true };
  assert.deepEqual(activeExtraFilters(extra), ["project", "kind", "showCancelled"]);
  assert.equal(hasActiveFilters(extra), true);
});
test("etichetta singolare e plurale dei risultati", () => {
  assert.equal(movementsLabel(0), "0 movimenti");
  assert.equal(movementsLabel(1), "1 movimento");
  assert.equal(movementsLabel(2), "2 movimenti");
});
