// QS_TEST_BUILD=<cartella tsc commonjs> NODE_PATH=./node_modules node --test tests/questionnaires-api.test.mjs
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const build = process.env.QS_TEST_BUILD;
const skip = !build;
const load = (path) => (skip ? {} : require(build + path));
const qs = load("/app/api/questionari/[...path]/route.js");
const pub = load("/app/api/q/[token]/route.js");
const assoc = load("/app/api/associazione/[...path]/route.js");
const receipts = load("/app/api/associazione/ricevute/route.js");
const original = global.fetch;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "secret";
process.env.ADMIN_ALLOWED_EMAIL = "owner@example.org";
after(() => (global.fetch = original));

const me = "00000000-0000-0000-0000-000000000002",
  other = "00000000-0000-0000-0000-000000000009",
  qid = "10000000-0000-0000-0000-000000000001",
  sid = "20000000-0000-0000-0000-000000000001",
  q1 = "30000000-0000-0000-0000-000000000001",
  q2 = "30000000-0000-0000-0000-000000000002",
  o1 = "40000000-0000-0000-0000-000000000001",
  o2 = "40000000-0000-0000-0000-000000000002",
  token = "0123456789abcdef0123456789abcdef";
const long = "=Risposta lunghissima \"citata\";\n".repeat(20000) + "fine";
let profile, calls, rpcError, questionnaireOwner;
function as(role, psychologist = false, owner = false) {
  profile = { role, psychologist, owner };
  calls = [];
  rpcError = null;
  questionnaireOwner = me;
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    const u = new URL(url);
    if (u.pathname === "/auth/v1/user") return Response.json({ id: me, email: profile.owner ? "owner@example.org" : "x@example.org" });
    if (u.pathname.endsWith("/association_members"))
      return Response.json([{ name: "Utente", role: profile.role, psychologist: profile.psychologist, active: true, activated_at: "2026-10-01T00:00:00Z" }]);
    if (u.pathname.endsWith("/association_movements")) return Response.json([]);
    if (u.pathname.startsWith("/rest/v1/rpc/")) {
      if (rpcError) return Response.json(rpcError, { status: 400 });
      const name = u.pathname.split("/").pop();
      if (name === "qs_submit_limit") return Response.json(true);
      if (name === "qs_submit") return Response.json(1);
      if (name === "qs_purge_expired") return Response.json(0);
      if (name === "association_save_movement") return Response.json({ id: qid });
      return Response.json({ id: qid, status: "draft", version: 1 });
    }
    if (u.pathname.endsWith("/qs_questionnaires"))
      return Response.json([{ id: qid, owner_id: questionnaireOwner, title: "Emozioni", status: "published", version: 2, qs_sessions: [] }]);
    if (u.pathname.endsWith("/qs_sessions")) return Response.json([{ id: sid, questionnaire_id: qid, token, label: "Sessione 2 novembre", status: "open" }]);
    if (u.pathname.endsWith("/qs_questions"))
      return Response.json([
        { id: q1, kind: "multiple", prompt: "Cosa ti è servito?", help: "", required: true, qs_options: [{ id: o2, label: "Confronto", position: 1 }, { id: o1, label: "Ascolto", position: 0 }] },
        { id: q2, kind: "text", prompt: "Racconta", help: "", required: true, qs_options: [] },
      ]);
    if (u.pathname.endsWith("/qs_submissions"))
      return Response.json(
        u.searchParams.get("offset") === "0" || !u.searchParams.has("offset")
          ? [
              { id: "s1", seq: 1, submitted_at: "2026-11-02T18:30:00Z", qs_answers: [{ question_id: q1, option_ids: [o1, o2], text_value: null }, { question_id: q2, option_ids: null, text_value: long }] },
              { id: "s2", seq: 2, submitted_at: "2026-11-02T18:31:00Z", qs_answers: [{ question_id: q1, option_ids: [o2], text_value: null }, { question_id: q2, option_ids: null, text_value: "Seconda persona" }] },
            ]
          : [],
        { headers: { "Content-Range": "0-1/2" } },
      );
    throw Error("Unexpected fetch: " + url);
  };
}
const ctx = (path) => ({ params: Promise.resolve({ path: path.split("/") }) });
function req(base, path, body, headers = {}) {
  return new Request(`https://site.example/api/${base}/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer test", "Content-Type": "application/json", ...headers },
    ...(body ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
  });
}
const status = async (promise) => (await promise).status;
const wrote = () => calls.some((c) => /rpc\/association_save_movement|association_movements/.test(c.url) && c.init.method === "POST");

test("senza token nessuna query al database", { skip }, async () => {
  as("member");
  assert.equal(await status(qs.GET(new Request("https://site.example/api/questionari/list"), ctx("list"))), 401);
  assert.equal(calls.length, 0);
});

test("socio: contabilità in sola lettura e nessun questionario", { skip }, async () => {
  as("member");
  assert.equal(await status(assoc.GET(req("associazione", "movements"), ctx("movements"))), 200);
  assert.equal(await status(assoc.POST(req("associazione", "movements", { date: "2026-11-01", amount: "10", kind: "income", account: "cash", category: "Donazioni", description: "x" }), ctx("movements"))), 403);
  assert.equal(wrote(), false, "nessuna scrittura contabile");
  assert.equal(await status(receipts.GET(req("associazione", "ricevute"))), 403);
  assert.equal(await status(qs.GET(req("questionari", "list"), ctx("list"))), 403);
  assert.equal(await status(qs.POST(req("questionari", "save", { title: "x", questions: [] }), ctx("save"))), 403);
});

test("psicologa: nessun accesso a contabilità, ricevute, utenti", { skip }, async () => {
  as("none", true);
  const meRes = await assoc.GET(req("associazione", "me"), ctx("me"));
  assert.equal(meRes.status, 200);
  assert.deepEqual((await meRes.json()).user, { id: me, name: "Utente", role: "none", psychologist: true });
  for (const path of ["movements", "members", "audit", "documents"])
    assert.equal(await status(assoc.GET(req("associazione", path), ctx(path))), 403, path);
  assert.equal(await status(assoc.POST(req("associazione", "movements", { amount: "10" }), ctx("movements"))), 403);
  assert.equal(await status(receipts.GET(req("associazione", "ricevute"))), 403);
  assert.equal(calls.some((c) => c.url.includes("association_movements")), false);
});

test("psicologa: vede solo i propri questionari", { skip }, async () => {
  as("none", true);
  const res = await qs.GET(req("questionari", "list"), ctx("list"));
  assert.equal(res.status, 200);
  assert.match(calls.find((c) => c.url.includes("qs_questionnaires")).url, new RegExp("owner_id=eq." + me));
  questionnaireOwner = other;
  assert.equal(await status(qs.GET(req("questionari", "questionnaire?id=" + qid), ctx("questionnaire"))), 404);
  assert.equal(await status(qs.GET(req("questionari", "submissions?session=" + sid), ctx("submissions"))), 404);
  assert.equal(await status(qs.POST(req("questionari", "status", { id: qid, action: "publish" }), ctx("status"))), 404);
  assert.equal(calls.some((c) => c.url.includes("/rpc/qs_set_status")), false);
});

test("ruoli cumulativi: psicologa + socio", { skip }, async () => {
  as("member", true);
  assert.equal(await status(qs.GET(req("questionari", "list"), ctx("list"))), 200);
  assert.equal(await status(assoc.GET(req("associazione", "movements"), ctx("movements"))), 200);
  assert.equal(await status(assoc.POST(req("associazione", "movements", { amount: "10" }), ctx("movements"))), 403);
});

test("super admin vede tutti i questionari; contabile può registrare movimenti", { skip }, async () => {
  as("none", false, true);
  await qs.GET(req("questionari", "list"), ctx("list"));
  assert.doesNotMatch(calls.find((c) => c.url.includes("qs_questionnaires")).url, /owner_id/);
  as("accountant");
  assert.equal(await status(qs.GET(req("questionari", "list"), ctx("list"))), 403);
  assert.equal(
    await status(assoc.POST(req("associazione", "movements", { date: "2026-11-01", amount: "10", kind: "income", account: "cash", category: "Donazioni", description: "Quota" }), ctx("movements"))),
    200,
  );
});

test("editor: validazione server e messaggi del database", { skip }, async () => {
  as("none", true);
  const bad = await qs.POST(req("questionari", "save", { title: "T", retention_months: null, questions: [{ kind: "single", prompt: "x", options: ["solo una"] }] }), ctx("save"));
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /almeno due opzioni/);
  rpcError = { code: "QS423", message: "Le domande si modificano solo in bozza." };
  const locked = await qs.POST(req("questionari", "save", { id: qid, version: 2, title: "T", retention_months: null }), ctx("save"));
  assert.equal(locked.status, 423);
  assert.match((await locked.json()).error, /solo in bozza/);
});

test("esportazioni: CSV e PDF senza perdita di testo", { skip }, async () => {
  as("none", true);
  const csv = await qs.GET(req("questionari", "export.csv?session=" + sid), ctx("export.csv"));
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-disposition"), /attachment/);
  const text = await csv.text();
  assert.ok(text.includes(long.replace(/^=/, "'=").replace(/"/g, '""')), "testo lungo integro e protetto da formula injection");
  assert.ok(text.includes("Ascolto | Confronto"));
  assert.ok(text.includes("Questionario anonimo 001") && text.includes("Questionario anonimo 002"));
  const pdf = await qs.GET(req("questionari", "export.pdf?session=" + sid + "&seq=2"), ctx("export.pdf"));
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
  const all = await qs.GET(req("questionari", "export.pdf?session=" + sid), ctx("export.pdf"));
  assert.ok((await all.arrayBuffer()).byteLength > 50000, "PDF completo con il testo lungo su più pagine");
});

test("compilazione pubblica: anonima, validata, protetta", { skip }, async () => {
  as("member");
  const pctx = (t) => ({ params: Promise.resolve({ token: t }) });
  const send = (body, t = token, headers = {}) =>
    pub.POST(new Request("https://site.example/api/q/" + t, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }), pctx(t));
  const answers = { [q1]: { options: [o1] }, [q2]: { text: "x".repeat(3_000_000) } };
  const key = crypto.randomUUID();
  assert.equal((await send({ client_key: key, answers }, "nonvalido")).status, 404);
  assert.equal((await send({ client_key: key, answers }, token, { Origin: "https://evil.example" })).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await send({ client_key: key, answers, website: "spam" })).status, 200);
  assert.equal(calls.length, 0, "honeypot: nessun salvataggio");
  const ok = await send({ client_key: key, answers });
  assert.equal(ok.status, 200);
  const submitted = calls.find((c) => c.url.endsWith("/rpc/qs_submit"));
  assert.equal(JSON.parse(submitted.init.body).p_answers[q2].text.length, 3_000_000, "risposta lunga inviata integralmente");
  assert.equal(calls.some((c) => c.url.includes("/auth/")), false, "nessun login richiesto");
  rpcError = { code: "QS410", message: "Questo questionario non accetta più risposte." };
  const closed = await send({ client_key: key, answers: { [q1]: { options: [o1] } } });
  assert.equal(closed.status, 410);
  assert.equal((await send("x".repeat(4_100_000))).status, 413);
});
