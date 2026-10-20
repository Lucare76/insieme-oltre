import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = process.env.ACCESS_TEST_BUILD;
const { GET, POST } = require(root + "/app/api/accesso/[...path]/route.js");
const { POST: LOGIN } = require(root + "/app/api/admin/login/route.js");
const original = global.fetch;
const owner = "00000000-0000-0000-0000-000000000001",
  member = "00000000-0000-0000-0000-000000000002",
  requestId = "00000000-0000-0000-0000-000000000003";
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: "https://db.example",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "secret",
  ADMIN_USERNAME: "LucaAdmin",
  ADMIN_ALLOWED_EMAIL: "owner@example.org",
  BREVO_API_KEY: "brevo",
  CONTACT_FROM_EMAIL: "info@example.org",
});
let role,
  active,
  activated,
  duplicate,
  mailFail,
  approved,
  claimed,
  allow,
  calls,
  tokenOwner;
const req = (path, body, token = true) =>
  new Request("https://site.example/api/accesso/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer valid" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const ctx = (path) => ({ params: Promise.resolve({ path: [path] }) });
beforeEach(() => {
  role = "owner";
  active = true;
  activated = true;
  duplicate = false;
  mailFail = false;
  approved = false;
  claimed = false;
  allow = true;
  calls = [];
  tokenOwner = true;
  global.fetch = async (url, init = {}) => {
    const b =
      init.body && typeof init.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ url, b, method: init.method });
    const m = {
      user_id: member,
      name: "Mario Rossi",
      email: "mario@example.org",
      username: "mario.rossi",
      role,
      active,
      activated_at: activated ? "2026-10-20T00:00:00Z" : null,
    };
    if (url.endsWith("/auth/v1/user")) {
      if (init.method === "PUT") return Response.json({ id: member });
      return Response.json({
        id: tokenOwner ? owner : member,
        email: tokenOwner ? "owner@example.org" : "mario@example.org",
      });
    }
    if (url.includes("/association_access_limit")) return Response.json(allow);
    if (url.includes("/association_submit_access"))
      return Response.json(duplicate ? null : requestId);
    if (url.includes("/association_review_access")) {
      if (b.p_action === "claim") claimed = true;
      if (b.p_action === "approve") approved = true;
      return Response.json([
        {
          id: requestId,
          name: "Mario Rossi",
          email: "mario@example.org",
          username: "mario.rossi",
          status: "processing",
        },
      ]);
    }
    if (url.includes("/association_members?")) return Response.json([m]);
    if (url.includes("/admin/generate_link"))
      return Response.json({
        id: member,
        email: "mario@example.org",
        hashed_token: "private-one-time-token",
        verification_type: b.type,
      });
    if (url.endsWith("/auth/v1/verify"))
      return Response.json({
        access_token: "activation-token",
        user: { id: member, email: "mario@example.org" },
      });
    if (url.includes("/association_activate_member"))
      return Response.json(active);
    if (url.includes("/auth/v1/token"))
      return Response.json({
        access_token: "valid",
        refresh_token: "refresh",
        expires_at: 9999999999,
      });
    if (url.includes("/association_access_requests?")) return Response.json([]);
    if (url.includes("/auth/v1/logout")) return Response.json({});
    if (url === "https://api.brevo.com/v3/smtp/email")
      return Response.json({}, { status: mailFail ? 503 : 201 });
    throw new Error("Unexpected fetch " + url);
  };
});
after(() => (global.fetch = original));
const form = {
  name: "Mario Rossi",
  email: "mario@example.org",
  username: "mario.rossi",
  privacy: true,
};
test("richiesta pubblica registra senza creare account o assegnare ruoli", async () => {
  const res = await POST(
    req("request", { ...form, role: "owner" }, false),
    ctx("request"),
  );
  assert.equal(res.status, 200);
  assert.equal(
    calls.some((x) => x.url.includes("generate_link")),
    false,
  );
  assert.equal(
    calls.some((x) => x.url.includes("save_member")),
    false,
  );
  const notification = calls.find((x) => x.url.includes("brevo"));
  assert.equal(notification.b.to[0].email, "owner@example.org");
});
test("richieste duplicate: esito generico, nessuna email duplicata", async () => {
  duplicate = true;
  const res = await POST(req("request", form, false), ctx("request"));
  assert.equal(res.status, 200);
  assert.equal(
    calls.some((x) => x.url.includes("brevo")),
    false,
  );
});
test("richiesta conserva esito positivo se notifica fallisce", async () => {
  mailFail = true;
  assert.equal(
    (await POST(req("request", form, false), ctx("request"))).status,
    200,
  );
});
test("validazione nome utente, privacy, account principale e origine", async () => {
  for (const b of [
    { ...form, username: "LucaAdmin" },
    { ...form, username: "admin" },
    { ...form, privacy: false },
    { ...form, email: "owner@example.org" },
    { ...form, username: "bad/username" },
  ])
    assert.equal(
      (await POST(req("request", b, false), ctx("request"))).status,
      400,
    );
  const r = new Request("https://site.example/api/accesso/request", {
    method: "POST",
    headers: {
      Origin: "https://other.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(form),
  });
  assert.equal((await POST(r, ctx("request"))).status, 403);
});
test("limite persistente blocca prima di generare account o messaggi", async () => {
  allow = false;
  assert.equal(
    (await POST(req("request", form, false), ctx("request"))).status,
    429,
  );
  assert.equal(calls.length, 1);
});
test("socio e contabile non possono leggere richieste o approvarle", async () => {
  tokenOwner = false;
  for (const r of ["member", "accountant"]) {
    role = r;
    assert.equal((await GET(req("requests"), ctx("requests"))).status, 403);
    assert.equal(
      (
        await POST(
          req("review", { id: requestId, action: "approve", role: "member" }),
          ctx("review"),
        )
      ).status,
      403,
    );
  }
  assert.equal(claimed, false);
});
test("owner approva ruolo scelto; token solo nell’email e accesso ancora da attivare", async () => {
  const res = await POST(
    req("review", { id: requestId, action: "approve", role: "accountant" }),
    ctx("review"),
  );
  assert.equal(res.status, 200);
  assert.equal(approved, true);
  const commit = calls.find((x) => x.b?.p_action === "approve");
  assert.equal(commit.b.p_role, "accountant");
  const mail = calls.find((x) => x.url.includes("brevo"));
  assert.equal(mail.b.to[0].email, "mario@example.org");
  assert.match(mail.b.textContent, /#token_hash=private-one-time-token/);
  assert.ok(
    !JSON.stringify(await res.json()).includes("private-one-time-token"),
  );
});
test("nessuno può assegnare owner dalla richiesta", async () => {
  const r = await POST(
    req("review", { id: requestId, action: "approve", role: "owner" }),
    ctx("review"),
  );
  assert.equal(r.status, 400);
  assert.equal(approved, false);
});
test("errore invio invito dopo approvazione è recuperabile", async () => {
  mailFail = true;
  const r = await POST(
    req("review", { id: requestId, action: "approve", role: "member" }),
    ctx("review"),
  );
  assert.equal(r.status, 200);
  assert.equal(approved, true);
  assert.match((await r.json()).warning, /Reinvia/);
});
test("imposta password: verifica token, aggiorna password e attiva solo account abilitato", async () => {
  activated = false;
  const r = await POST(
    req(
      "password",
      { token_hash: "hash", type: "invite", password: "NuovaPassword123!" },
      false,
    ),
    ctx("password"),
  );
  assert.equal(r.status, 200);
  assert.ok(
    calls.find((x) => x.url.endsWith("/auth/v1/user") && x.method === "PUT"),
  );
  assert.ok(calls.find((x) => x.url.includes("activate_member")));
  assert.ok(calls.find((x) => x.url.includes("logout")));
});
test("invito di utente disattivato non può riabilitarlo né modificare password", async () => {
  active = false;
  const r = await POST(
    req(
      "password",
      { token_hash: "hash", type: "recovery", password: "NuovaPassword123!" },
      false,
    ),
    ctx("password"),
  );
  assert.equal(r.status, 403);
  assert.ok(
    !calls.find((x) => x.url.endsWith("/auth/v1/user") && x.method === "PUT"),
  );
});
test("login con nome utente: risolve email sul server e verifica attivazione", async () => {
  tokenOwner = false;
  role = "member";
  const r = await LOGIN(
    req("login", { username: "Mario.Rossi", password: "Password123!" }),
  );
  assert.equal(r.status, 200);
  assert.equal((await r.json()).user.role, "member");
  const query = calls.find((x) => x.url.includes("username=eq."));
  assert.match(query.url, /activated_at=not.is.null/);
  assert.equal(
    calls.find((x) => x.url.includes("/auth/v1/token")).b.email,
    "mario@example.org",
  );
});
test("username admin esistente continua a funzionare", async () => {
  const r = await LOGIN(
    req("login", { username: "LucaAdmin", password: "Password123!" }),
  );
  assert.equal(r.status, 200);
  assert.equal((await r.json()).user.role, "owner");
  assert.equal(
    calls.find((x) => x.url.includes("/auth/v1/token")).b.email,
    "owner@example.org",
  );
});
test("recupero pubblico non espone se un’email esiste", async () => {
  const r = await POST(
    req("recover", { email: "mario@example.org" }, false),
    ctx("recover"),
  );
  assert.equal(r.status, 200);
  assert.match((await r.json()).message, /Se l’email/);
});
