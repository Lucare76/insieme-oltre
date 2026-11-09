import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const card = readFileSync(new URL("../app/admin/libri-sociali/MembershipCards.tsx", import.meta.url), "utf8");
const util = readFileSync(new URL("../lib/membershipCard.ts", import.meta.url), "utf8");
const verify = readFileSync(new URL("../app/api/verifica-tessera/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/admin/libri-sociali/page.tsx", import.meta.url), "utf8");

test("tessera digitale usa logo originale, un solo modello e QR di verifica reale", () => {
  assert.match(card, /\/insieme-oltre-logo\.png/);
  assert.match(card, /TESSERA ASSOCIATIVA/);
  assert.match(card, /import\("qrcode"\)/);
  assert.match(card, /\/verifica-tessera\?codice=/);
  assert.match(card, /image\/png/);
  assert.match(card, /Scarica tessera PNG/);
  assert.doesNotMatch(card, /Socio Ordinario|Socio Sostenitore/);
  assert.match(page, /<MembershipCards people={items}/);
});

test("verifica pubblica non espone dati anagrafici e rifiuta tessere scadute", () => {
  assert.match(verify, /register_kind=eq\.soci/);
  assert.match(verify, /isMembershipCardValid/);
  assert.doesNotMatch(verify, /select=full_name|select=\*/);
  assert.match(util, /person\.ended_on >= today/);
  assert.match(util, /Number\(today\.slice\(0, 4\)\) === year/);
});
