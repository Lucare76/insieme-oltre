// PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node --test tests/receipts-db.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test(
  "Postgres: numerazione, idempotenza, immutabilità, annullamento e accessi",
  { skip: !process.env.PGLITE_MODULE },
  async () => {
    const { PGlite } = await import(process.env.PGLITE_MODULE);
    const db = new PGlite();
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
    create table auth.users(id uuid primary key);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    insert into auth.users values('00000000-0000-0000-0000-000000000001');grant usage on schema public,auth to service_role;`);
      for (const file of [
        "20261020095949_association_accounting.sql",
        "20261023142050_association_receipts.sql",
      ])
        await db.exec(
          await readFile(
            new URL("../supabase/migrations/" + file, import.meta.url),
            "utf8",
          ),
        );
      for (const role of ["anon", "authenticated"]) {
        await db.exec(`set role ${role}`);
        await assert.rejects(() =>
          db.query("select * from public.association_receipts"),
        );
        await db.exec("reset role");
        assert.equal(
          (
            await db.query(
              "select has_function_privilege($1,'public.association_issue_receipt(uuid,uuid,integer,uuid,jsonb,jsonb)','execute') as allowed",
              [role],
            )
          ).rows[0].allowed,
          false,
        );
      }
      const actor = "00000000-0000-0000-0000-000000000001",
        id = "00000000-0000-0000-0000-000000000002";
      await db.exec("set role service_role");
      const movement = (
        await db.query(
          `select * from public.association_save_movement(null,null,$1,$2::jsonb,null)`,
          [
            actor,
            JSON.stringify({
              date: "2026-10-20",
              kind: "income",
              amount_cents: 60000,
              account: "bank",
              category: "Raccolta fondi",
              project: "Natale",
              description: "Incasso",
              private_note: "",
            }),
          ],
        )
      ).rows[0];
      const issue = (requestId = id) =>
        db.query(
          "select * from public.association_issue_receipt($1,$2,1,$3,'{}','{}')",
          [requestId, movement.id, actor],
        );
      const first = (await issue()).rows[0];
      const retry = (await issue()).rows[0];
      assert.equal(first.id, retry.id);
      assert.equal(first.number, retry.number);
      assert.equal(
        (await db.query("select count(*) from public.association_movements"))
          .rows[0].count,
        1,
      );
      await assert.rejects(
        () => issue("00000000-0000-0000-0000-000000000003"),
        /already issued/,
      );
      await assert.rejects(
        () =>
          db.query(
            "update public.association_receipts set amount_cents=1 where id=$1",
            [id],
          ),
        /immutable/,
      );
      await assert.rejects(
        () =>
          db.query(
            "update public.association_movements set amount_cents=1 where id=$1",
            [movement.id],
          ),
        /cancel receipt first/,
      );
      await db.query(
        "update public.association_receipts set pdf_base64='pdf-archived' where id=$1",
        [id],
      );
      await assert.rejects(
        () =>
          db.query(
            "update public.association_receipts set pdf_base64='other' where id=$1",
            [id],
          ),
        /immutable/,
      );
      await db.query(
        "update public.association_receipts set mail_status='sending' where id=$1",
        [id],
      );
      await assert.rejects(
        () =>
          db.query(
            "update public.association_receipts set cancelled=true,cancellation_reason='Correzione dati errati' where id=$1",
            [id],
          ),
        /invalid cancellation/,
      );
      await db
        .query(
          "update public.association_receipts set mail_status='sent',cancelled=true,cancellation_reason='Correzione dati errati' where id=$1",
          [id],
        )
        .catch(async () => {
          await db.query(
            "update public.association_receipts set mail_status='sent' where id=$1",
            [id],
          );
          await db.query(
            "update public.association_receipts set cancelled=true,cancellation_reason='Correzione dati errati' where id=$1",
            [id],
          );
        });
      const replacement = (await issue("00000000-0000-0000-0000-000000000004"))
        .rows[0];
      assert.ok(replacement.number > first.number);
      await assert.rejects(() =>
        db.query("delete from public.association_receipts where id=$1", [id]),
      );
      const audit = await db.query(
        "select * from public.association_audit where entity='association_receipts'",
      );
      assert.ok(audit.rows.length >= 5);
    } finally {
      await db.close();
    }
  },
);
