import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const owner = "00000000-0000-0000-0000-000000000001",
  psy = "00000000-0000-0000-0000-000000000002",
  socio = "00000000-0000-0000-0000-000000000003";
async function database() {
  const { PGlite } = await import(process.env.PGLITE_MODULE);
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);grant usage on schema public,auth to service_role;insert into auth.users values('${owner}'),('${psy}'),('${socio}');`,
  );
  for (const file of [
    "20261020095949_association_accounting.sql",
    "20261020103759_association_access_approval.sql",
    "20261103100000_questionnaires_rbac.sql",
  ])
    await db.exec(await readFile(new URL("../supabase/migrations/" + file, import.meta.url), "utf8"));
  return db;
}
const one = async (db, sql, params) => (await db.query(sql, params)).rows[0];
const code = (sqlState) => (error) => error.code === sqlState;

test(
  "ruoli cumulativi: psicologa senza contabilità, socio in sola lettura",
  { skip: !process.env.PGLITE_MODULE },
  async () => {
    const db = await database();
    try {
      await db.exec("set role service_role");
      const id = (await one(db, "select public.association_submit_access($1,$2,$3) as id", ["Dott.ssa Test", "psy@example.org", "psicologa"])).id;
      await db.query("select public.association_review_access($1,$2,'claim')", [id, owner]);
      // Nessun permesso: ruolo economico assente senza abilitazione questionari.
      await assert.rejects(() => db.query("select public.association_review_access($1,$2,'approve',$3,'none',false)", [id, owner, psy]));
      await db.query("select public.association_review_access($1,$2,'approve',$3,'none',true)", [id, owner, psy]);
      const member = await one(db, "select role,psychologist,activated_at from public.association_members where user_id=$1", [psy]);
      assert.deepEqual([member.role, member.psychologist, member.activated_at], ["none", true, null]);
      // Revoca e cumulo dei ruoli tramite la funzione esistente.
      await db.query("select public.association_save_member($1,$2)", [owner, { user_id: psy, name: "Dott.ssa Test", username: "psicologa", role: "member", psychologist: true, active: true }]);
      assert.equal((await one(db, "select role from public.association_members where user_id=$1", [psy])).role, "member");
      // Compatibilità con il codice in produzione: chiamate senza i nuovi parametri.
      await db.query("select public.association_save_member($1,$2)", [owner, { user_id: psy, name: "Dott.ssa Test", username: "psicologa", role: "member", active: true }]);
      assert.equal((await one(db, "select psychologist from public.association_members where user_id=$1", [psy])).psychologist, true, "il vecchio pannello non azzera il ruolo Psicologa");
      const old = (await one(db, "select public.association_submit_access($1,$2,$3) as id", ["Socio Vecchio", "old@example.org", "vecchio"])).id;
      await db.query("select public.association_review_access(p_id=>$1,p_actor=>$2,p_action=>'claim')", [old, owner]);
      await db.query("select public.association_review_access(p_id=>$1,p_actor=>$2,p_action=>'approve',p_user=>$3,p_role=>'member')", [old, owner, socio]);
      assert.deepEqual(await one(db, "select role,psychologist from public.association_members where user_id=$1", [socio]), { role: "member", psychologist: false });
      await assert.rejects(() => db.query("select public.association_save_member($1,$2)", [owner, { user_id: psy, name: "X", username: "psicologa", role: "none", psychologist: false, active: true }]));
      assert.equal((await one(db, "select count(*)::int n from public.association_audit where entity='association_members'")).n, 2);
      await db.exec("reset role");
      for (const role of ["anon", "authenticated"]) {
        await db.exec("set role " + role);
        for (const sql of [
          "select * from public.association_movements",
          "insert into public.association_movements(date,kind,amount_cents,account,category,description,created_by,updated_by) values('2026-01-01','income',1,'cash','x','x','" + socio + "','" + socio + "')",
          "update public.association_members set role='accountant'",
          "select * from public.qs_answers",
          "select * from public.qs_submissions",
          "select * from public.qs_questionnaires",
          "select public.qs_submit('00000000000000000000000000000000','" + socio + "','{}')",
          "select public.qs_session_stats('" + socio + "')",
        ])
          await assert.rejects(() => db.query(sql), undefined, `${role}: ${sql}`);
        await db.exec("reset role");
      }
    } finally {
      await db.close();
    }
  },
);

test(
  "questionari: bozza, pubblicazione, invii anonimi, sessioni separate, blocchi",
  { skip: !process.env.PGLITE_MODULE },
  async () => {
    const db = await database();
    try {
      await db.exec("set role service_role");
      const long = "Testo molto lungo àèìòù “virgolette” 😊\n".repeat(30000);
      const q = await one(db, "select * from public.qs_save($1,null,null,$2)", [psy, {
        title: "Emozioni dei genitori", description: "", meeting_ref: "Incontro di novembre", retention_months: null,
        questions: [
          { kind: "single", prompt: "Come stai?", required: true, options: ["Bene", "Così così", "Male"] },
          { kind: "multiple", prompt: "Cosa ti è servito?", required: false, options: ["Ascolto", "Confronto", "Informazioni"] },
          { kind: "text", prompt: "Racconta", required: true },
        ],
      }]);
      assert.equal(q.status, "draft");
      await assert.rejects(() => db.query("select public.qs_save($1,$2,$3,$4)", [psy, q.id, q.version, { title: "x", questions: [{ kind: "single", prompt: "x", options: ["solo"] }] }]), code("QS422"));
      await assert.rejects(() => db.query("select public.qs_save($1,$2,99,$3)", [psy, q.id, { title: "x" }]), code("QS409"));
      const questions = (await db.query("select id,kind from public.qs_questions where questionnaire_id=$1 order by position", [q.id])).rows;
      const options = async (qid) => (await db.query("select id from public.qs_options where question_id=$1 order by position", [qid])).rows.map((r) => r.id);
      const [o1, o2] = [await options(questions[0].id), await options(questions[1].id)];

      await db.query("select public.qs_set_status($1,$2,'publish')", [psy, q.id]);
      const s1 = await one(db, "select * from public.qs_sessions where questionnaire_id=$1", [q.id]);
      assert.match(s1.token, /^[0-9a-f]{32}$/);
      assert.equal(s1.label, "Incontro di novembre");
      await assert.rejects(() => db.query("select public.qs_save($1,$2,$3,$4)", [psy, q.id, 2, { title: "x", questions: [] }]), code("QS423"));
      const s2 = await one(db, "select * from public.qs_new_session($1,$2,'Sessione 16 novembre','2026-11-16')", [psy, q.id]);

      const answers = (single, multiple, text) => ({
        [questions[0].id]: { options: single }, [questions[1].id]: { options: multiple }, [questions[2].id]: { text },
      });
      const submit = (token, key, value) => db.query("select public.qs_submit($1,$2,$3) as seq", [token, key, value]);
      const key = () => crypto.randomUUID();
      // Validazione server: obbligatorie, opzioni estranee, scelta singola.
      await assert.rejects(() => submit(s1.token, key(), answers([], [], "x")), code("QS422"));
      await assert.rejects(() => submit(s1.token, key(), answers([o1[0], o1[1]], [], "x")), code("QS422"));
      await assert.rejects(() => submit(s1.token, key(), answers([o2[0]], [], "x")), code("QS422"));
      await assert.rejects(() => submit(s1.token, key(), answers([o1[0]], [], "   ")), code("QS422"));
      await assert.rejects(() => submit(s1.token, key(), { ...answers([o1[0]], [], "x"), [crypto.randomUUID()]: { text: "x" } }), code("QS422"));
      await assert.rejects(() => submit("f".repeat(32), key(), answers([o1[0]], [], "x")), code("QS404"));
      assert.equal((await one(db, "select count(*)::int n from public.qs_submissions")).n, 0, "nessuna compilazione parziale");

      const fixed = key();
      assert.equal((await submit(s1.token, fixed, answers([o1[0]], [o2[0], o2[2]], long))).rows[0].seq, 1);
      assert.equal((await submit(s1.token, fixed, answers([o1[0]], [o2[0], o2[2]], long))).rows[0].seq, 1, "invio ripetuto idempotente");
      // Invii simultanei: numerazione progressiva senza duplicati.
      const results = await Promise.all(Array.from({ length: 25 }, (_, n) => submit(s1.token, key(), answers([o1[n % 3]], n % 2 ? [o2[1]] : [], "Risposta " + n))));
      assert.deepEqual(results.map((r) => r.rows[0].seq).sort((a, b) => a - b), Array.from({ length: 25 }, (_, n) => n + 2));
      await submit(s2.token, key(), answers([o1[2]], [], "Seconda sessione"));

      const stored = await one(db, "select a.text_value from public.qs_answers a join public.qs_submissions s on s.id=a.submission_id where s.seq=1 and s.session_id=$1 and a.text_value is not null", [s1.id]);
      assert.equal(stored.text_value, long, "testo lungo integro");
      const stats = (await one(db, "select public.qs_session_stats($1) as v", [s1.id])).v;
      assert.equal(stats.total, 26);
      assert.equal(stats.questions[0].options.reduce((sum, o) => sum + o.count, 0), 26);
      assert.equal(stats.questions[1].options[1].count, 12);
      assert.equal((await one(db, "select public.qs_session_stats($1) as v", [s2.id])).v.total, 1, "sessioni separate");

      await db.query("select public.qs_session_status($1,$2,false)", [psy, s1.id]);
      await assert.rejects(() => submit(s1.token, key(), answers([o1[0]], [], "x")), code("QS410"));
      await db.query("select public.qs_session_status($1,$2,true)", [psy, s1.id]);
      await db.query("select public.qs_set_status($1,$2,'close')", [psy, q.id]);
      await assert.rejects(() => submit(s2.token, key(), answers([o1[0]], [], "x")), code("QS410"));
      await assert.rejects(() => db.query("select public.qs_set_status($1,$2,'draft')", [psy, q.id]), code("QS423"));
      await assert.rejects(() => db.query("delete from public.qs_questions where questionnaire_id=$1", [q.id]), "domande con risposte non eliminabili");
      await db.query("select public.qs_set_status($1,$2,'reopen')", [psy, q.id]);
      await db.query("select public.qs_set_status($1,$2,'archive')", [psy, q.id]);
      assert.equal((await one(db, "select count(*)::int n from public.qs_sessions where questionnaire_id=$1 and status='open'", [q.id])).n, 0);

      const copy = await one(db, "select * from public.qs_duplicate($1,$2)", [psy, q.id]);
      assert.equal(copy.status, "draft");
      assert.equal((await one(db, "select count(*)::int n from public.qs_options o join public.qs_questions x on x.id=o.question_id where x.questionnaire_id=$1", [copy.id])).n, 6);
      await db.query("select public.qs_delete_draft($1,$2)", [psy, copy.id]);
      await assert.rejects(() => db.query("select public.qs_delete_draft($1,$2)", [psy, q.id]), code("QS409"));

      assert.equal((await one(db, "select public.qs_delete_results($1,$2) as n", [psy, s2.id])).n, 1);
      await db.query("update public.qs_questionnaires set retention_months=1 where id=$1", [q.id]);
      await db.query("update public.qs_submissions set submitted_at=now()-interval '2 months' where seq<=5");
      assert.equal((await one(db, "select public.qs_purge_expired() as n")).n, 5);
      assert.equal((await one(db, "select count(*)::int n from public.qs_answers a left join public.qs_submissions s on s.id=a.submission_id where s.id is null")).n, 0, "nessuna risposta scollegata");

      for (let n = 0; n < 200; n++) assert.equal((await one(db, "select public.qs_submit_limit('ip') as ok")).ok, true);
      assert.equal((await one(db, "select public.qs_submit_limit('ip') as ok")).ok, false);
    } finally {
      await db.close();
    }
  },
);
