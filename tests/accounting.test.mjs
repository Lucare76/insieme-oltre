import { createRequire } from "node:module";
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

test("riepilogo annuale: saldi complessivi, mesi e categorie senza trasferimenti né annullati", async () => {
  const { accountingReport } = createRequire(import.meta.url)(
    process.env.ACCOUNTING_REPORT_BUILD + "/accountingReports.js",
  );
  const base = {
    id: "a",
    date: "2026-10-20",
    account: "bank",
    category: "Materiali",
    cancelled: false,
    description: "Test",
  };
  const entries = [
    { ...base, date: "2025-12-01", kind: "opening", amount_cents: 10000 },
    { ...base, id: "b", kind: "income", amount_cents: 5000 },
    { ...base, id: "c", kind: "transfer", amount_cents: 2000 },
    { ...base, id: "d", account: "cash", kind: "expense", amount_cents: 1200 },
    { ...base, id: "e", kind: "expense", amount_cents: 800 },
    { ...base, id: "f", kind: "expense", amount_cents: 90000, cancelled: true },
    {
      ...base,
      id: "g",
      date: "2027-01-01",
      kind: "income",
      amount_cents: 1000,
    },
  ];
  const report = accountingReport(entries, "2026");
  assert.deepEqual(report.period, {
    income: 5000,
    expense: 2000,
    bank: 2200,
    cash: 800,
  });
  assert.equal(report.totals.bank + report.totals.cash, 14000);
  assert.deepEqual(report.monthly[9], {
    month: 9,
    income: 5000,
    expense: 2000,
  });
  assert.equal(report.monthly[0].income, 0);
  assert.deepEqual(report.expenses, [{ name: "Materiali", amount: 2000 }]);
  assert.equal(report.recent[0].id, "g");
  assert.equal(
    report.recent.some((x) => x.id === "f"),
    false,
  );
  assert.equal(accountingReport([], "2026").monthly.length, 12);
});
