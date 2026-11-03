// Percorso completo nel browser, isolato dalla produzione: un finto Supabase locale esegue
// le vere funzioni SQL delle migrazioni su PGlite; il sito gira con `next start` puntato su di esso.
// npm run build && PGLITE_MODULE=file:///…/pglite/dist/index.js PLAYWRIGHT_MODULE=file:///…/playwright/index.mjs \
//   SHOT_DIR=/tmp/qs-shots node tests/questionnaires-e2e.mjs
import http from "node:http";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import QRCode from "qrcode";

const MOCK_PORT = 54399,
  SITE_PORT = 3107,
  SITE = `http://localhost:${SITE_PORT}`,
  PASSWORD = "Password-di-prova-1";
const shots = process.env.SHOT_DIR;
if (shots) await mkdir(shots, { recursive: true });
const users = {
  owner: { id: "00000000-0000-0000-0000-000000000001", email: "owner@test.invalid" },
  psicologa: { id: "00000000-0000-0000-0000-000000000002", email: "psy@test.invalid" },
  socio: { id: "00000000-0000-0000-0000-000000000003", email: "socio@test.invalid" },
  mix: { id: "00000000-0000-0000-0000-000000000004", email: "mix@test.invalid" },
};

// --- Database e finto PostgREST/Auth ---------------------------------------------------------
const { PGlite } = await import(process.env.PGLITE_MODULE);
const db = new PGlite({ parsers: { 1082: (v) => v, 1114: (v) => v, 1184: (v) => v } });
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);grant usage on schema public,auth to service_role;` +
    Object.values(users).map((u) => `insert into auth.users values('${u.id}');`).join(""),
);
for (const file of ["20261020095949_association_accounting.sql", "20261020103759_association_access_approval.sql", "20261103100000_questionnaires_rbac.sql"])
  await db.exec(await readFile(new URL("../supabase/migrations/" + file, import.meta.url), "utf8"));
await db.exec(`insert into public.association_members(user_id,name,email,username,role,psychologist,active,activated_at) values
 ('${users.psicologa.id}','Dott.ssa Prova','${users.psicologa.email}','psicologa','none',true,true,now()),
 ('${users.socio.id}','Socio Prova','${users.socio.email}','socio','member',false,true,now()),
 ('${users.mix.id}','Psicologa Socia','${users.mix.email}','psico.socia','member',true,true,now());
 set role service_role;`);

const rels = {
  "qs_questionnaires>qs_sessions": { many: true, fk: "questionnaire_id" },
  "qs_sessions>qs_questionnaires": { many: false, local: "questionnaire_id" },
  "qs_questions>qs_options": { many: true, fk: "question_id" },
  "qs_submissions>qs_answers": { many: true, fk: "submission_id" },
};
const ident = (v) => {
  if (!/^\w+$/.test(v)) throw Error("bad identifier " + v);
  return v;
};
function split(text) {
  const out = [];
  let depth = 0,
    cur = "";
  for (const c of text) {
    if (c === "," && !depth) {
      out.push(cur);
      cur = "";
      continue;
    }
    if (c === "(") depth++;
    if (c === ")") depth--;
    cur += c;
  }
  return [...out, cur].filter(Boolean);
}
function selectSql(table, list) {
  return split(list)
    .map((item) => {
      const m = item.match(/^(\w+)\((.*)\)$/);
      if (!m) return item === "*" ? "t.*" : "t." + ident(item);
      const rel = rels[table + ">" + m[1]];
      const obj = `jsonb_build_object(${split(m[2]).map((c) => `'${ident(c)}',c.${ident(c)}`).join(",")})`;
      return rel.many
        ? `(select coalesce(jsonb_agg(${obj}),'[]'::jsonb) from public.${m[1]} c where c.${rel.fk}=t.id) as ${m[1]}`
        : `(select ${obj} from public.${m[1]} c where c.id=t.${rel.local}) as ${m[1]}`;
    })
    .join(",");
}
/** Sottoinsieme di PostgREST usato dal sito: filtri eq/lt/gt/is, select con risorse annidate, ordine, pagine. */
async function rest(table, params, count) {
  const where = [],
    values = [];
  for (const [key, raw] of params) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    const col = "t." + ident(key);
    if (raw === "not.is.null") where.push(col + " is not null");
    else if (raw === "is.null") where.push(col + " is null");
    else {
      const [op, ...parts] = raw.split(".");
      values.push(parts.join("."));
      const n = "$" + values.length;
      where.push(op === "eq" ? `${col}::text = ${n}` : `${col} ${op === "lt" ? "<" : ">"} ${n}::int`);
    }
  }
  const base = `from public.${ident(table)} t ${where.length ? "where " + where.join(" and ") : ""}`;
  const order = (params.get("order") || "")
    .split(",")
    .filter(Boolean)
    .map((o) => "t." + ident(o.split(".")[0]) + (o.endsWith(".desc") ? " desc" : ""));
  const sql = `select ${selectSql(table, params.get("select") || "*")} ${base} ${order.length ? "order by " + order.join(",") : ""} limit ${Number(params.get("limit")) || 100000} offset ${Number(params.get("offset")) || 0}`;
  const rows = (await db.query(sql, values)).rows;
  const total = count ? (await db.query(`select count(*)::int n ${base}`, values)).rows[0].n : null;
  return { rows, total };
}
const jsonArgs = new Set(["p_data", "p_answers", "p_member"]);
const mock = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://mock");
  let body = "";
  for await (const chunk of req) body += chunk;
  const send = (status, data, headers = {}) => {
    if (status >= 400 && process.env.E2E_DEBUG) console.error("mock", status, req.method, req.url);
    res.writeHead(status, { "Content-Type": "application/json", ...headers });
    res.end(data === undefined ? "" : JSON.stringify(data));
  };
  try {
    const bearer = (req.headers.authorization || "").replace("Bearer ", "");
    if (url.pathname === "/auth/v1/token") {
      const b = JSON.parse(body);
      const user = Object.values(users).find((u) => (b.refresh_token ? b.refresh_token === "ref." + u.id : u.email === b.email && b.password === PASSWORD));
      if (!user) return send(400, { error: "invalid_grant" });
      return send(200, { access_token: "tok." + user.id, refresh_token: "ref." + user.id, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user });
    }
    if (url.pathname === "/auth/v1/user") {
      const user = Object.values(users).find((u) => bearer === "tok." + u.id);
      return user ? send(200, user) : send(401, {});
    }
    if (url.pathname === "/auth/v1/logout") return send(204);
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const name = ident(url.pathname.split("/").pop());
      const args = body ? JSON.parse(body) : {};
      const keys = Object.keys(args);
      const sql = `select * from public.${name}(${keys.map((k, i) => `${ident(k)} => $${i + 1}${jsonArgs.has(k) ? "::jsonb" : ""}`).join(",")})`;
      const result = await db.query(sql, keys.map((k) => (jsonArgs.has(k) && args[k] !== null ? JSON.stringify(args[k]) : args[k])));
      const scalar = result.fields.length === 1 && result.fields[0].name === name;
      return send(200, scalar ? (result.rows[0]?.[name] ?? null) : result.rows[0]);
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.slice(9);
      if (req.method !== "GET") return send(204);
      if (!table.startsWith("qs_") && table !== "association_members") return send(200, []);
      const { rows, total } = await rest(table, url.searchParams, /count=exact/.test(req.headers.prefer || ""));
      return send(200, rows, total === null ? {} : { "Content-Range": total ? `0-${rows.length - 1}/${total}` : "*/0" });
    }
    send(404, {});
  } catch (error) {
    if (!/^QS|^40001$/.test(error.code || "")) console.error("mock:", req.method, req.url, error.message);
    send(400, { code: error.code, message: error.message });
  }
});
await new Promise((r) => mock.listen(MOCK_PORT, "127.0.0.1", r));

// --- Sito in modalità produzione, variabili solo di test -------------------------------------
const testEnv = {
    ...process.env,
    NEXT_DIST_DIR: ".next-e2e",
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test",
    SUPABASE_SERVICE_ROLE_KEY: "service-test",
    ADMIN_ALLOWED_EMAIL: users.owner.email,
    ADMIN_USERNAME: "luca.test",
    BREVO_API_KEY: "",
    WHATSAPP_ACCESS_TOKEN: "",
};
if (!process.env.E2E_SKIP_BUILD) {
  // next build aggiunge la cartella dei tipi a tsconfig.json: il file viene ripristinato subito dopo.
  const tsconfig = await readFile("tsconfig.json", "utf8");
  const build = spawn(process.execPath, ["node_modules/next/dist/bin/next", "build"], { env: testEnv, stdio: "inherit" });
  const code = await new Promise((r) => build.on("exit", r));
  await writeFile("tsconfig.json", tsconfig);
  assert.equal(code, 0, "build di test non riuscita");
}
const site = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(SITE_PORT)], {
  env: testEnv,
  stdio: ["ignore", "pipe", "pipe"],
});
site.stderr.on("data", (d) => process.stderr.write(d));
for (let i = 0; ; i++) {
  try {
    if ((await fetch(SITE + "/admin")).ok) break;
  } catch {}
  if (i > 300) throw Error("Il sito non si avvia");
  await new Promise((r) => setTimeout(r, 200));
}

const { chromium, devices } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ headless: true });
const errors = [];
const watch = (page) => {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
};
const local = (url) => url.replace(/^https?:\/\/[^/]+/, SITE);
const tokenOf = (url) => url.split("/").pop();
const shot = (page, name) => shots && page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
const noOverflow = async (page, label) =>
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "overflow orizzontale: " + label);
async function login(page, username) {
  await page.goto(SITE + "/admin");
  await page.getByLabel("Nome utente").first().fill(username);
  await page.getByLabel("Password").first().fill(PASSWORD);
  await page.getByRole("button", { name: /Entra/ }).click();
}
const token = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("insieme_oltre_admin_session")).access_token);
const count = async (sql, params) => (await db.query(sql, params)).rows[0].n;
const passed = [];
const step = async (name, fn) => {
  await fn();
  passed.push(name);
  console.log("✔ " + name);
};

try {
  const desk = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const psy = await desk.newPage();
  watch(psy);
  let link, link2;

  await step("login psicologa → reindirizzata all’area questionari", async () => {
    await login(psy, "psicologa");
    await psy.waitForURL("**/admin/questionari");
    await psy.getByRole("heading", { name: "Sessioni attive" }).waitFor();
    await shot(psy, "01-dashboard");
  });

  await step("editor: scelta singola, multipla, libera, riordino, anteprima, pubblicazione autonoma", async () => {
    await psy.getByRole("button", { name: "+ Crea nuovo questionario" }).click();
    await psy.getByLabel("Titolo *").fill("Emozioni dei genitori");
    await psy.getByLabel("Incontro di riferimento").fill("Incontro del 2 novembre 2026");
    await psy.getByRole("button", { name: "+ Risposta libera" }).click();
    await psy.getByRole("button", { name: "+ Scelta singola" }).click();
    await psy.getByRole("button", { name: "+ Scelta multipla" }).click();
    const q = (n) => psy.locator(".qs-question").nth(n);
    await q(0).getByLabel("Testo della domanda").fill("Racconta come ti senti in questo periodo");
    await q(1).getByLabel("Testo della domanda").fill("Come stai oggi?");
    for (const [i, v] of ["Bene", "Così così", "Male"].entries()) {
      if (i > 1) await q(1).getByRole("button", { name: "+ Aggiungi opzione" }).click();
      await q(1).locator(".qs-option input").nth(i).fill(v);
    }
    await q(2).getByLabel("Testo della domanda").fill("Cosa ti è stato utile?");
    for (const [i, v] of ["Ascolto", "Confronto", "Informazioni"].entries()) {
      if (i > 1) await q(2).getByRole("button", { name: "+ Aggiungi opzione" }).click();
      await q(2).locator(".qs-option input").nth(i).fill(v);
    }
    await q(2).getByLabel("Risposta obbligatoria").uncheck();
    // Riordino: la domanda libera diventa l’ultima.
    await q(0).getByRole("button", { name: "Sposta giù la domanda 1" }).click();
    await q(1).getByRole("button", { name: "Sposta giù la domanda 2" }).click();
    assert.equal(await q(2).getByLabel("Testo della domanda").inputValue(), "Racconta come ti senti in questo periodo");
    await shot(psy, "02-editor");
    await psy.getByRole("button", { name: "Anteprima" }).click();
    await psy.getByText("Come stai oggi?").waitFor();
    await shot(psy, "03-anteprima");
    await psy.getByRole("button", { name: "Torna all’editor" }).click();
    await psy.getByRole("button", { name: "Salva e pubblica" }).click();
    await psy.getByRole("heading", { name: "Sessioni e QR code" }).waitFor();
    await psy.locator(".qs-qr-image svg").first().waitFor();
    link = await psy.getByLabel("Link di partecipazione").inputValue();
    assert.match(link, /\/q\/[0-9a-f]{32}$/);
    await shot(psy, "04-qr");
  });

  await step("QR code: codifica esattamente il link della sessione, download PNG", async () => {
    const shown = await psy.locator(".qs-qr-image").first().innerHTML();
    const expected = await QRCode.toString(link, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#1f3326", light: "#ffffff" } });
    const modules = (svg) => [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join("|");
    assert.equal(modules(shown), modules(expected));
    const download = psy.waitForEvent("download");
    await psy.getByRole("button", { name: "Scarica PNG" }).click();
    assert.match((await download).suggestedFilename(), /\.png$/);
  });

  await step("seconda sessione con link e QR distinti", async () => {
    await psy.getByLabel("Nuova sessione").fill("Sessione del 16 novembre");
    await psy.getByRole("button", { name: "Crea sessione e QR" }).click();
    await psy.waitForFunction((old) => document.querySelector(".qs-qr-side input")?.value !== old, link);
    link2 = await psy.getByLabel("Link di partecipazione").inputValue();
    assert.notEqual(link2, link);
  });

  const phone = await browser.newContext({ ...devices["iPhone 13"] });
  const part = await phone.newPage();
  watch(part);
  const long = "Una risposta molto lunga, con accenti àèìòù e a capo.\n".repeat(400) + "FINE-TESTO";

  await step("compilazione anonima da smartphone, recupero bozza, testo molto lungo", async () => {
    await part.goto(local(link));
    await part.getByText("Come stai oggi?").waitFor();
    await noOverflow(part, "questionario pubblico");
    await shot(part, "05-mobile-form");
    await part.getByLabel("Così così").check();
    await part.reload();
    await part.getByText("Abbiamo recuperato le risposte").waitFor();
    assert.ok(await part.getByLabel("Così così").isChecked());
    await part.getByLabel("Ascolto").check();
    await part.getByLabel("Confronto").check();
    await part.getByRole("textbox", { name: "Racconta come ti senti in questo periodo" }).fill(long);
    assert.ok(await part.getByRole("button", { name: "Invia le risposte" }).isDisabled(), "consenso richiesto");
    await part.getByLabel(/acconsento/).check();
    await part.getByRole("button", { name: "Invia le risposte" }).click();
    await part.getByRole("heading", { name: "Grazie!" }).waitFor();
    await shot(part, "06-mobile-grazie");
    assert.equal(await part.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("insieme_qs_draft_")).length), 0, "bozza locale cancellata");
    assert.ok(!(await (await fetch(local(link))).text()).includes("FINE-TESTO"), "la pagina pubblica non espone risposte");
  });

  await step("risposte obbligatorie segnalate prima dell’invio (seconda sessione)", async () => {
    const p2 = await phone.newPage();
    watch(p2);
    await p2.goto(local(link2));
    await p2.getByLabel(/acconsento/).check();
    await p2.getByRole("button", { name: "Invia le risposte" }).click();
    await p2.getByText("Mancano 2 risposte obbligatorie.").waitFor();
    await p2.getByLabel("Male").check();
    await p2.getByRole("textbox").fill("Risposta della seconda sessione");
    await p2.getByRole("button", { name: "Invia le risposte" }).click();
    await p2.getByRole("heading", { name: "Grazie!" }).waitFor();
  });

  await step("20 invii simultanei: numerazione senza buchi, invii incompleti rifiutati per intero", async () => {
    const questions = (await db.query("select x.id,x.kind from public.qs_questions x join public.qs_sessions s on s.questionnaire_id=x.questionnaire_id where s.token=$1 order by x.position", [tokenOf(link)])).rows;
    const options = (await db.query("select id from public.qs_options where question_id=$1 order by position", [questions[0].id])).rows;
    const post = (answers) =>
      fetch(`${SITE}/api/q/${tokenOf(link)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_key: crypto.randomUUID(), answers }) });
    const rejected = await Promise.all(Array.from({ length: 5 }, () => post({ [questions[2].id]: { text: "manca la prima" } })));
    assert.ok(rejected.every((r) => r.status === 422));
    const ok = await Promise.all(Array.from({ length: 20 }, (_, n) => post({ [questions[0].id]: { options: [options[n % 3].id] }, [questions[2].id]: { text: "Partecipante " + (n + 2) } })));
    assert.ok(ok.every((r) => r.status === 200), "tutti gli invii accettati");
    const seqs = (await db.query("select seq from public.qs_submissions s join public.qs_sessions x on x.id=s.session_id where x.token=$1 order by seq", [tokenOf(link)])).rows.map((r) => r.seq);
    assert.deepEqual(seqs, Array.from({ length: 21 }, (_, n) => n + 1));
    assert.equal(await count("select count(*)::int n from public.qs_answers a where not exists(select 1 from public.qs_submissions s where s.id=a.submission_id)"), 0);
  });

  await step("schede individuali: tutte le risposte della stessa persona, testo integrale, precedente/successiva", async () => {
    await psy.getByRole("button", { name: "Risultati" }).last().click();
    await psy.getByText("21 compilazioni ricevute").waitFor();
    await psy.getByRole("button", { name: /Questionario anonimo 001/ }).click();
    const free = psy.locator(".qs-card .qs-free");
    await free.waitFor();
    assert.equal(await free.textContent(), long, "risposta libera completa");
    assert.deepEqual(await psy.locator(".qs-card .qs-picked li").allTextContents(), ["Così così", "Ascolto", "Confronto"]);
    await shot(psy, "07-scheda");
    await psy.getByRole("button", { name: "Successiva →" }).click();
    await psy.locator(".qs-card h3", { hasText: "Questionario anonimo 002" }).waitFor();
    assert.equal(await psy.locator(".qs-index li").count(), 21);
  });

  await step("statistiche: conteggi, percentuali, risposte libere leggibili", async () => {
    await psy.getByRole("button", { name: "Statistiche" }).click();
    await psy.locator(".qs-bars").first().waitFor();
    assert.deepEqual(await psy.locator(".qs-stat").first().locator(".qs-bar-label strong").allTextContents(), ["7 · 33,3%", "8 · 38,1%", "6 · 28,6%"]);
    await psy.getByRole("button", { name: "Leggi tutte le risposte scritte" }).click();
    await psy.getByText("Partecipante 21").waitFor();
    await shot(psy, "08-statistiche");
  });

  await step("esportazione CSV e PDF senza perdita di testo", async () => {
    let download = psy.waitForEvent("download");
    await psy.getByRole("button", { name: "Esporta CSV / Excel" }).click();
    const csv = await readFile(await (await download).path(), "utf8");
    assert.ok(csv.includes(long) && csv.includes("Questionario anonimo 021"));
    download = psy.waitForEvent("download");
    await psy.getByRole("button", { name: "Esporta PDF (tutte le schede)" }).click();
    assert.equal((await readFile(await (await download).path())).subarray(0, 4).toString(), "%PDF");
  });

  await step("chiusura della sessione: nessuna nuova compilazione; sessioni separate", async () => {
    await psy.getByRole("button", { name: /← Emozioni dei genitori/ }).click();
    const row = psy.locator(".qs-sessions > li", { hasText: "Incontro del 2 novembre 2026" });
    await row.getByRole("button", { name: "Chiudi sessione" }).click();
    await row.getByRole("button", { name: "Riapri sessione" }).waitFor();
    await part.goto(local(link));
    await part.getByRole("heading", { name: "Questionario chiuso" }).waitFor();
    const r = await fetch(`${SITE}/api/q/${tokenOf(link)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_key: crypto.randomUUID(), answers: {} }) });
    assert.equal(r.status, 410);
    assert.equal(await count("select count(*)::int n from public.qs_submissions s join public.qs_sessions x on x.id=s.session_id where x.token=$1", [tokenOf(link2)]), 1);
  });

  await step("psicologa: contabilità, utenti e ricevute bloccati anche via API diretta", async () => {
    const t = await token(psy);
    for (const path of ["movements", "members", "audit", "ricevute"])
      assert.equal((await fetch(`${SITE}/api/associazione/${path}`, { headers: { Authorization: "Bearer " + t } })).status, 403, path);
    assert.equal((await fetch(`${SITE}/api/associazione/movements`, { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: "{}" })).status, 403);
  });

  await step("socio: consultazione senza scrittura e senza questionari", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    watch(p);
    await login(p, "socio");
    await p.getByRole("heading", { name: /Benvenuto/ }).waitFor();
    assert.equal(await p.getByRole("link", { name: /Questionari/ }).count(), 0);
    const t = await token(p);
    assert.equal((await fetch(`${SITE}/api/associazione/movements`, { headers: { Authorization: "Bearer " + t } })).status, 200);
    assert.equal((await fetch(`${SITE}/api/questionari/list`, { headers: { Authorization: "Bearer " + t } })).status, 403);
    const body = JSON.stringify({ date: "2026-11-01", amount: "10", kind: "income", account: "cash", category: "Donazioni", description: "x" });
    assert.equal((await fetch(`${SITE}/api/associazione/movements`, { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body })).status, 403);
    assert.equal(await count("select count(*)::int n from public.association_movements"), 0);
    await p.goto(SITE + "/admin/questionari");
    await p.getByText("Area riservata ai questionari.").waitFor();
    await ctx.close();
  });

  await step("ruoli cumulativi: Psicologa + Socio vede contabilità e solo i propri questionari", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const p = await ctx.newPage();
    watch(p);
    await login(p, "psico.socia");
    await p.getByText("Psicologa Socia · Socio + Psicologa").waitFor();
    await p.getByRole("link", { name: "Questionari →" }).click();
    await p.waitForURL("**/admin/questionari");
    await p.getByText("Nessuna sessione aperta").waitFor();
    assert.equal(await p.getByText("Emozioni dei genitori").count(), 0, "non vede i questionari di altre professioniste");
    await ctx.close();
  });

  await step("super admin: utenti con ruolo Psicologa e tutti i questionari", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    watch(p);
    await login(p, "luca.test");
    await p.getByRole("button", { name: "Utenti e permessi" }).first().click();
    await p.getByText(/psy@test\.invalid.*Psicologa/).waitFor();
    await p.goto(SITE + "/admin/questionari");
    await p.getByRole("button", { name: /Pubblicati e chiusi \(1\)/ }).waitFor();
    await p.getByText("di un’altra professionista").waitFor();
    await noOverflow(p, "dashboard mobile");
    await shot(p, "09-admin-mobile");
    await ctx.close();
  });

  await step("risultati consultabili su smartphone", async () => {
    await psy.setViewportSize({ width: 390, height: 844 });
    await psy.getByRole("button", { name: "Risultati" }).first().click();
    await psy.getByRole("button", { name: /Questionario anonimo 001/ }).click();
    await psy.locator(".qs-card .qs-free").waitFor();
    await noOverflow(psy, "risultati mobile");
    await shot(psy, "10-risultati-mobile");
  });

  assert.deepEqual(errors, [], "errori JavaScript nelle pagine");
  console.log(`\n${passed.length} verifiche nel browser superate.`);
} catch (error) {
  for (const context of browser.contexts())
    for (const page of context.pages()) console.error("--- " + page.url() + "\n" + (await page.locator("body").innerText().catch(() => "")).slice(0, 1500));
  console.error(errors);
  throw error;
} finally {
  await browser.close();
  site.kill();
  mock.close();
  await db.close();
}
