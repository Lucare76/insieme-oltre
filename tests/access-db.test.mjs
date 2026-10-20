import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test(
  "richieste: approvazione atomica, attivazione, username e permessi",
  { skip: !process.env.PGLITE_MODULE },
  async () => {
    const { PGlite } = await import(process.env.PGLITE_MODULE);
    const db = new PGlite();
    try {
      await db.exec(
        `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);grant usage on schema public,auth to service_role;insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`,
      );
      for (const file of [
        "20261020095949_association_accounting.sql",
        "20261020103759_association_access_approval.sql",
      ])
        await db.exec(
          await readFile(
            new URL("../supabase/migrations/" + file, import.meta.url),
            "utf8",
          ),
        );
      const owner = "00000000-0000-0000-0000-000000000001",
        user = "00000000-0000-0000-0000-000000000002";
      for (const role of ["anon", "authenticated"]) {
        await db.exec("set role " + role);
        await assert.rejects(() =>
          db.query("select * from public.association_access_requests"),
        );
        await assert.rejects(() =>
          db.query("select public.association_submit_access($1,$2,$3)", [
            "Test",
            "test@example.org",
            "test",
          ]),
        );
        await db.exec("reset role");
      }
      await db.exec("set role service_role");
      for (let n = 0; n < 5; n++)
        assert.equal(
          (
            await db.query(
              "select public.association_access_limit('hash','request') as ok",
            )
          ).rows[0].ok,
          true,
        );
      assert.equal(
        (
          await db.query(
            "select public.association_access_limit('hash','request') as ok",
          )
        ).rows[0].ok,
        false,
      );
      const id = (
        await db.query(
          "select public.association_submit_access($1,$2,$3) as id",
          ["Nome Test", "test@example.org", "test.user"],
        )
      ).rows[0].id;
      assert.equal(
        (
          await db.query(
            "select public.association_submit_access($1,$2,$3) as id",
            ["Other", "test@example.org", "another"],
          )
        ).rows[0].id,
        null,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.association_members",
          )
        ).rows[0].n,
        0,
      );
      const review = async (action, role = null) =>
        db.query(
          "select * from public.association_review_access($1,$2,$3,$4,$5)",
          [id, owner, action, user, role],
        );
      await review("claim");
      await assert.rejects(() => review("claim"), /already reviewed/);
      await assert.rejects(
        () => review("approve", "owner"),
        /invalid approval/,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from public.association_members",
          )
        ).rows[0].n,
        0,
      );
      await review("approve", "member");
      let m = (await db.query("select * from public.association_members"))
        .rows[0];
      assert.equal(m.activated_at, null);
      assert.equal(m.role, "member");
      assert.equal(m.username, "test.user");
      assert.equal(
        (
          await db.query(
            "select public.association_activate_member($1) as ok",
            [user],
          )
        ).rows[0].ok,
        true,
      );
      assert.notEqual(
        (await db.query("select activated_at from public.association_members"))
          .rows[0].activated_at,
        null,
      );
      await db.query("select public.association_save_member($1,$2::jsonb)", [
        owner,
        JSON.stringify({
          user_id: user,
          name: "Nome",
          username: "test.user",
          role: "accountant",
          active: false,
        }),
      ]);
      assert.equal(
        (
          await db.query(
            "select public.association_activate_member($1) as ok",
            [user],
          )
        ).rows[0].ok,
        false,
      );
      await assert.rejects(
        () => review("approve", "member"),
        /invalid approval/,
      );
      const history = await db.query(
        "select action from public.association_audit",
      );
      assert.deepEqual(
        history.rows.map((x) => x.action),
        ["approve", "activate", "permissions"],
      );
    } finally {
      await db.close();
    }
  },
);
