// ACCOUNTING_TEST_BUILD=/tmp/insieme-api-tests node --test tests/accounting-api.test.mjs
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { GET, POST } = require(
  process.env.ACCOUNTING_TEST_BUILD +
    "/app/api/associazione/[...path]/route.js",
);
const original = global.fetch;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "secret";
process.env.ADMIN_ALLOWED_EMAIL = "owner@example.org";
const id = "00000000-0000-0000-0000-000000000001";
let role = "member",
  active = true,
  owner = false,
  calls = [],
  count = 0;
function mock() {
  calls = [];
  count = 0;
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/auth/v1/user"))
      return Response.json({
        id,
        email: owner ? "owner@example.org" : "member@example.org",
      });
    if (url.includes("/association_members?"))
      return Response.json([{ name: "Socio", role, active }]);
    if (url.includes("/association_movements?")) {
      const params = new URL(url).searchParams;
      assert.ok(
        !params.get("select").includes("private_note") ||
          role !== "member" ||
          owner,
      );
      if (count++ === 0)
        return Response.json(
          Array.from({ length: 500 }, (_, i) => ({ id: String(i) })),
        );
      return Response.json([{ id: "501" }]);
    }
    if (url.includes("/rpc/association_save_movement"))
      return Response.json({});
    throw Error("Unexpected fetch: " + url);
  };
}
function request(path, body) {
  return new Request("https://site.example/api/associazione/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer test",
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const ctx = (path) => ({ params: Promise.resolve({ path: path.split("/") }) });
after(() => (global.fetch = original));
test("nessun token: non interroga il database", async () => {
  mock();
  assert.equal(
    (await GET(new Request("https://site.example"), ctx("movements"))).status,
    401,
  );
  assert.equal(calls.length, 0);
});
test("socio legge tutti i movimenti paginati senza note riservate", async () => {
  owner = false;
  role = "member";
  active = true;
  mock();
  const res = await GET(request("movements"), ctx("movements"));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).items.length, 501);
  assert.match(res.headers.get("cache-control"), /no-store/);
});
test("socio non modifica, non vede documenti, storico o utenti", async () => {
  mock();
  for (const path of ["movements", "members", "documents"])
    assert.equal(
      (await POST(request(path, { amount: "10" }), ctx(path))).status,
      403,
    );
  for (const path of ["members", "audit", "documents", "document/" + id])
    assert.equal((await GET(request(path), ctx(path))).status, 403);
  assert.equal(calls.filter((x) => x.url.includes("/rpc/")).length, 0);
});
test("revoca con token ancora valido blocca la richiesta successiva", async () => {
  active = false;
  mock();
  assert.equal((await GET(request("movements"), ctx("movements"))).status, 403);
  active = true;
});
test("contabile scrive ma non gestisce permessi e storico", async () => {
  role = "accountant";
  mock();
  const data = {
    date: "2026-10-20",
    amount: "10,23",
    kind: "income",
    account: "bank",
    category: "Quote",
    description: "Quota socio",
  };
  assert.equal(
    (await POST(request("movements", data), ctx("movements"))).status,
    200,
  );
  const rpc = calls.find((x) => x.url.includes("/rpc/"));
  const body = JSON.parse(rpc.init.body);
  assert.equal(body.p_actor, id);
  assert.equal(body.p_data.amount_cents, 1023);
  for (const path of ["members", "audit"])
    assert.equal((await GET(request(path), ctx(path))).status, 403);
});
test("validazione server blocca importi e date errati prima della scrittura", async () => {
  mock();
  for (const changes of [
    { amount: "1e9" },
    { date: "2026-02-30" },
    { kind: "unknown" },
    { id: "malicious" },
    { id, version: 0 },
  ]) {
    assert.equal(
      (
        await POST(
          request("movements", {
            date: "2026-10-20",
            amount: "10",
            kind: "income",
            account: "bank",
            category: "Quote",
            description: "Quota",
            ...changes,
          }),
          ctx("movements"),
        )
      ).status,
      400,
    );
  }
  assert.equal(calls.filter((x) => x.url.includes("/rpc/")).length, 0);
});
test("owner mantiene accesso anche senza ruolo assegnato", async () => {
  owner = true;
  mock();
  const res = await GET(request("me"), ctx("me"));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).user.role, "owner");
  assert.equal(calls.length, 1);
  owner = false;
});
