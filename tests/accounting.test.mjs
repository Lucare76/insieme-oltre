import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCents, validDate, balances, csvCell } from "../lib/accounting.ts";
test("importi esatti in centesimi e validazione", () => {
  for (const [s, n] of [
    ["1,01", 101],
    ["12.50", 1250],
    ["99", 9900],
    ["0,01", 1],
  ])
    assert.equal(parseCents(s), n);
  for (const s of ["0", "-1", "1e3", "1.001", "1,000.00", null, NaN])
    assert.equal(parseCents(s), null);
  assert.equal(validDate("2028-02-29"), true);
  for (const d of [
    "2026-02-29",
    "2026-13-01",
    "2026-00-00",
    "20/10/2026",
    "1900-01-01",
  ])
    assert.equal(validDate(d), false);
});
test("trasferimenti non gonfiano entrate; saldo iniziale e annullamenti", () => {
  const base = { account: "bank", cancelled: false };
  const items = [
    { ...base, kind: "opening", amount_cents: 10000 },
    { ...base, kind: "income", amount_cents: 3000 },
    { ...base, kind: "transfer", amount_cents: 2000 },
    { ...base, account: "cash", kind: "expense", amount_cents: 700 },
    { ...base, kind: "income", amount_cents: 99000, cancelled: true },
  ];
  assert.deepEqual(balances(items), {
    income: 3000,
    expense: 700,
    bank: 11000,
    cash: 1300,
  });
  assert.equal(balances(items).bank + balances(items).cash, 12300);
});
test("CSV neutralizza formule e conserva virgolette", () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell("normal"), '"normal"');
});
