import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(path, "utf8");
const api = read("lib/accessServer.ts");
const admin = read("app/admin/page.tsx");
const password = read("app/admin/imposta-password/page.tsx");
const schema = read("supabase/migrations/20261108181500_admin_manual_access_invites.sql");
const panel = read("app/admin/accessComponents.tsx");

test("la creazione manuale passa dal ruolo Admin e non dal rate limit pubblico", () => {
  assert.match(api, /const owner = await authorize\(request, true, true\);/);
  assert.match(api, /route === "manual-request" && request.method === "POST"/);
  assert.match(api, /b.confirm !== true/);
  assert.match(api, /reserved\(username\)/);
  assert.match(api, /email === allowedAdminEmail\(\)/);
  assert.match(api, /membersByEmail.length \|\| membersByUsername.length/);
  assert.match(api, /requestsByEmail.length \|\| requestsByUsername.length/);
  assert.match(api, /created_by_admin: owner.id, privacy_at: null/);
  assert.match(api, /status: "pending"/);
  assert.doesNotMatch(api, /route === "manual-request"[\s\S]*?await limit\(request, "request"\)/);
});

test("la UI richiede la conferma amministrativa e la successiva approvazione", () => {
  assert.match(admin, /Prepara invito manuale/);
  assert.match(admin, /access\/manual-request/);
  assert.match(admin, /confirm: fields.confirm === "on"/);
  assert.match(admin, /Crea richiesta manuale/);
  assert.match(admin, /setTab\("requests"\)/);
  assert.match(panel, /Richiesta predisposta manualmente dall.amministratore/);
});

test("nessuna accettazione privacy viene simulata per richieste manuali", () => {
  assert.match(schema, /add column if not exists created_by_admin uuid/);
  assert.match(schema, /alter column privacy_at drop not null/);
  assert.match(password, /privacy: f.get\("privacy"\) === "on"/);
  assert.match(password, /name="privacy" required/);
  assert.match(api, /if \(b.privacy !== true\)/);
  assert.match(api, /created_by_admin=not.is.null&privacy_at=is.null/);
  assert.match(api, /privacy_at: new Date\(\).toISOString\(\)/);
  assert.match(api, /await auth\("user", \{ password \}, "PUT", token\);/);
});

test("l'invito email resta sul flusso di review già autorizzato", () => {
  assert.match(api, /route === "review" && request.method === "POST"/);
  assert.match(api, /await sendAccessLink\(/);
  assert.match(api, /generateAccessLink\(req.email, true\)/);
});
