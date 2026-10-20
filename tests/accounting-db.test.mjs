// PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node --test tests/accounting-db.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const enabled = Boolean(process.env.PGLITE_MODULE);
test(
  "Postgres: schema, ruoli, audit atomico, concorrenza e annullamento",
  { skip: !enabled },
  async () => {
    const { PGlite } = await import(process.env.PGLITE_MODULE);
    const db = new PGlite();
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls; create schema auth;create schema storage;
 create table auth.users(id uuid primary key);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 insert into auth.users values('00000000-0000-0000-0000-000000000001'); grant usage on schema public,auth to service_role;`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261020093447_association_accounting.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const actor = "00000000-0000-0000-0000-000000000001";
    const data = {
      date: "2026-10-20",
      kind: "income",
      amount_cents: 1250,
      account: "bank",
      category: "Donazioni",
      project: "Natale",
      description: "Donazione test",
      private_note: "Riservato",
    };
    for (const role of ["anon", "authenticated"]) {
      for (const table of [
        "association_members",
        "association_movements",
        "association_audit",
        "association_documents",
      ]) {
        await db.exec(`set role ${role}`);
        await assert.rejects(() => db.query(`select * from public.${table}`));
        await db.exec("reset role");
      }
      const r = await db.query(
        `select has_function_privilege($1,'public.association_save_movement(uuid,integer,uuid,jsonb,text)','execute') as allowed`,
        [role],
      );
      assert.equal(r.rows[0].allowed, false);
    }
    await db.exec("set role service_role");
    const res = await db.query(
      `select * from public.association_save_movement(null,null,$1,$2::jsonb,null)`,
      [actor, JSON.stringify(data)],
    );
    const item = res.rows[0];
    assert.equal(Number(item.amount_cents), 1250);
    assert.equal(item.version, 1);
    await db.query(
      `select public.association_save_movement($1,1,$2,$3::jsonb,null)`,
      [item.id, actor, JSON.stringify({ ...data, amount_cents: 1450 })],
    );
    await assert.rejects(
      () =>
        db.query(
          `select public.association_save_movement($1,1,$2,$3::jsonb,null)`,
          [item.id, actor, JSON.stringify(data)],
        ),
      /stale/,
    );
    const count = await db.query(
      "select count(*) as n from public.association_audit",
    );
    assert.equal(Number(count.rows[0].n), 2);
    await db.query(
      `select public.association_save_movement($1,2,$2,null,'Registrazione duplicata')`,
      [item.id, actor],
    );
    const after = await db.query(
      "select cancelled,version from public.association_movements",
    );
    assert.deepEqual(after.rows[0], { cancelled: true, version: 3 });
    await assert.rejects(
      () =>
        db.query(
          `select public.association_save_movement($1,3,$2,$3::jsonb,null)`,
          [item.id, actor, JSON.stringify(data)],
        ),
      /stale/,
    );
    await assert.rejects(() =>
      db.query("delete from public.association_audit"),
    );
    await assert.rejects(() =>
      db.query("delete from public.association_movements"),
    );
    await db.query("select public.association_save_member($1,$2::jsonb)", [
      actor,
      JSON.stringify({
        user_id: actor,
        name: "Socio test",
        email: "test@example.org",
        role: "member",
        active: true,
      }),
    ]);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.association_audit where action='permissions'",
        )
      ).rows[0].n,
      1,
    );
    await db.close();
  },
);
