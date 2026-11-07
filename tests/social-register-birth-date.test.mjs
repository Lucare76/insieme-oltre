import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const route = readFileSync("app/api/associazione/libri-sociali/route.ts", "utf8");
const start = route.indexOf("const validBirthDate =");
const end = route.indexOf("const cleaned =", start);
assert.ok(start !== -1 && end > start, "validatore delle nascite presente nel route handler");
const js = ts.transpileModule(route.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const validBirthDate = runInNewContext(js + "; validBirthDate");

test("libro soci: una data di nascita precedente al 2000 è ammessa", () => {
  assert.equal(validBirthDate("1976-10-01"), true);
  assert.equal(validBirthDate("1950-12-31"), true);
  assert.equal(validBirthDate("2000-02-29"), true);
  assert.match(route, /validBirthDate\(body\.birth_date\)/);
});
test("libro soci: date inesistenti, date future e valori malformati sono bloccati", () => {
  for (const value of ["1976-02-30", "1977-02-29", "2050-01-01", "1976-10", "01/10/1976", "1899-12-31", null]) {
    assert.equal(validBirthDate(value), false, String(value));
  }
});
test("la validazione finanziaria per le altre date resta invariata", () => {
  assert.match(route, /!validDate\(body\.admitted_on\)/);
  assert.match(route, /!validDate\(body\.ended_on\)/);
  assert.doesNotMatch(route, /!validDate\(body\.birth_date\)/);
});
