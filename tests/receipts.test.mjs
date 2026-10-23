// RECEIPTS_TEST_BUILD=/tmp/receipt-api-build NODE_PATH=$PWD/node_modules node --test tests/receipts.test.mjs
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { receiptData } = require(
  process.env.RECEIPTS_TEST_BUILD + "/lib/receipts.js",
);
const { GET, POST } = require(
  process.env.RECEIPTS_TEST_BUILD + "/app/api/associazione/ricevute/route.js",
);
const original = global.fetch;
after(() => {
  global.fetch = original;
});
const id = "00000000-0000-0000-0000-000000000001";
const movement = {
  id,
  date: "2026-10-20",
  kind: "income",
  amount_cents: 60000,
  account: "bank",
  version: 1,
  cancelled: false,
};
const data = {
  type: "fundraising",
  name: "Agenzia esempio",
  tax_code: "12345678901",
  address: "Via Esempio 1, Ischia",
  email: "prova@example.org",
  description: "Raccolta fondi Natale: 30 panettoni",
  payment: "bank_transfer",
  reference: "TRN prova",
};
const issuer = {
  name: "Associazione esempio",
  tax_code: "12345678901",
  address: "Via Esempio 2, Ischia",
  representative: "Rappresentante esempio",
};
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "secret",
  ADMIN_ALLOWED_EMAIL: "owner@example.org",
  RECEIPT_ISSUER_NAME: issuer.name,
  RECEIPT_ISSUER_TAX_CODE: issuer.tax_code,
  RECEIPT_ISSUER_ADDRESS: issuer.address,
  RECEIPT_ISSUER_REPRESENTATIVE: issuer.representative,
  BREVO_API_KEY: "test",
  CONTACT_FROM_EMAIL: "info@example.org",
});
function request(body, token = true) {
  return new Request("https://example.org/api/associazione/ricevute", {
    method: body ? "POST" : "GET",
    headers: {
      ...(token ? { Authorization: "Bearer test" } : {}),
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
let role = "accountant",
  calls,
  state,
  behaviour;
function mock() {
  calls = [];
  behaviour = "ok";
  state = {
    id,
    number: 1,
    issued_on: "2026-10-23",
    movement_id: id,
    data,
    issuer,
    amount_cents: 60000,
    payment_date: "2026-10-20",
    cancelled: false,
    cancellation_reason: null,
    mail_status: "pending",
    sent_at: null,
    pdf_base64: Buffer.from("%PDF-test-archived").toString("base64"),
  };
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.endsWith("/auth/v1/user"))
      return Response.json({ id, email: "member@example.org" });
    if (url.includes("association_members?"))
      return Response.json([
        { name: "Contabile", role, active: true, activated_at: "2026-10-20" },
      ]);
    if (url.includes("association_movements?"))
      return Response.json([movement]);
    if (url.includes("/rpc/association_issue_receipt"))
      return Response.json(state);
    if (url.includes("association_receipts?")) {
      if (init.method === "PATCH") {
        if (
          url.includes("mail_status=eq.pending") &&
          state.mail_status !== "pending"
        )
          return Response.json([]);
        Object.assign(state, JSON.parse(init.body));
        return Response.json([state]);
      }
      return Response.json([state]);
    }
    if (url.includes("api.brevo.com")) {
      if (behaviour === "timeout") throw new Error("timeout");
      return Response.json({ messageId: "mail-1" });
    }
    throw new Error("Unexpected request " + url);
  };
}
test("validazione: niente ricevute su spese, incassi annullati, metodo incoerente o email non valida", () => {
  assert.equal(receiptData(data, movement).type, "fundraising");
  for (const changed of [
    { kind: "expense" },
    { cancelled: true },
    { account: "cash" },
  ])
    assert.throws(() => receiptData(data, { ...movement, ...changed }));
  for (const changed of [
    { email: "a\nb@example.org" },
    { type: "invoice" },
    { reference: "" },
    { tax_code: "x" },
  ])
    assert.throws(() => receiptData({ ...data, ...changed }, movement));
});
test("nessun token e soci: nessuna lettura ricevute o invio", async () => {
  mock();
  assert.equal((await GET(request(null, false))).status, 401);
  assert.equal(calls.length, 0);
  role = "member";
  assert.equal((await GET(request())).status, 403);
  assert.equal(
    (await POST(request({ action: "send", id, confirm_email: data.email })))
      .status,
    403,
  );
  assert.equal(
    calls.some(
      (x) => x.url.includes("association_receipts") || x.url.includes("brevo"),
    ),
    false,
  );
  role = "accountant";
});
test("anteprima PDF: nessuna emissione o email; conferma obbligatoria", async () => {
  mock();
  const body = {
    ...data,
    action: "preview",
    movement_id: id,
    version: 1,
    confirmed: true,
  };
  const res = await POST(request(body));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /application\/pdf/);
  assert.equal(
    Buffer.from(await res.arrayBuffer())
      .subarray(0, 4)
      .toString(),
    "%PDF",
  );
  assert.equal(
    calls.some((x) => x.url.includes("/rpc/") || x.url.includes("brevo")),
    false,
  );
  assert.equal(
    (await POST(request({ ...body, confirmed: false }))).status,
    400,
  );
});
test("emissione: solo RPC idempotente, nessun nuovo movimento o invio", async () => {
  mock();
  const res = await POST(
    request({
      ...data,
      action: "issue",
      id,
      movement_id: id,
      version: 1,
      confirmed: true,
    }),
  );
  assert.equal(res.status, 200);
  assert.equal(
    calls.filter((x) => x.url.includes("/rpc/association_issue_receipt"))
      .length,
    1,
  );
  assert.equal(
    calls.some(
      (x) =>
        x.url.includes("brevo") ||
        (x.url.includes("association_movements") && x.init.method === "POST"),
    ),
    false,
  );
});
test("invio: destinatario confermato, PDF archiviato e blocco doppio clic", async () => {
  mock();
  const body = { action: "send", id, confirm_email: data.email };
  assert.equal(
    (await POST(request({ ...body, confirm_email: "altro@example.org" })))
      .status,
    400,
  );
  assert.equal((await POST(request(body))).status, 200);
  assert.equal(state.mail_status, "sent");
  assert.equal((await POST(request(body))).status, 409);
  const mails = calls.filter((x) => x.url.includes("brevo"));
  assert.equal(mails.length, 1);
  const sent = JSON.parse(mails[0].init.body);
  assert.equal(sent.to[0].email, data.email);
  assert.equal(sent.attachment[0].content, state.pdf_base64);
  assert.equal(sent.htmlContent, undefined);
});
test("timeout: ricevuta conservata, esito incerto e nessun retry automatico", async () => {
  mock();
  behaviour = "timeout";
  const body = { action: "send", id, confirm_email: data.email };
  assert.equal((await POST(request(body))).status, 503);
  assert.equal(state.mail_status, "unknown");
  assert.equal((await POST(request(body))).status, 409);
  assert.equal(calls.filter((x) => x.url.includes("brevo")).length, 1);
});
test("dati associazione incompleti: emissione bloccata", async () => {
  mock();
  const previous = process.env.RECEIPT_ISSUER_TAX_CODE;
  delete process.env.RECEIPT_ISSUER_TAX_CODE;
  assert.equal(
    (
      await POST(
        request({
          ...data,
          action: "issue",
          id,
          movement_id: id,
          version: 1,
          confirmed: true,
        }),
      )
    ).status,
    503,
  );
  process.env.RECEIPT_ISSUER_TAX_CODE = previous;
  assert.equal(
    calls.some((x) => x.url.includes("/rpc/")),
    false,
  );
});
test("nuova ricevuta: anteprima senza incassi preesistenti e senza scritture", async () => {
  mock();
  const res = await POST(
    request({
      ...data,
      action: "preview",
      source: "new",
      amount: "25,50",
      date: "2026-10-20",
      confirmed: true,
    }),
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /application\/pdf/);
  assert.equal(
    calls.some(
      (x) =>
        x.url.includes("association_movements") ||
        x.url.includes("/rpc/") ||
        x.url.includes("brevo"),
    ),
    false,
  );
});
test("incasso automatico: una sola RPC atomica con importo esatto e conto derivato", async () => {
  for (const [payment, account, type, category] of [
    ["cash", "cash", "donation", "Donazioni"],
    ["bank_transfer", "bank", "fundraising", "Raccolta fondi"],
    ["card", "bank", "donation", "Donazioni"],
  ]) {
    mock();
    const res = await POST(
      request({
        ...data,
        id,
        action: "issue",
        source: "new",
        amount: "25,50",
        date: "2026-10-20",
        payment,
        type,
        project: "Natale",
        confirmed: true,
      }),
    );
    assert.equal(res.status, 200);
    const writes = calls.filter((x) => x.url.includes("/rpc/"));
    assert.equal(writes.length, 1);
    assert.match(writes[0].url, /association_issue_receipt_with_income$/);
    const args = JSON.parse(writes[0].init.body);
    assert.equal(args.p_income.amount_cents, 2550);
    assert.equal(args.p_income.account, account);
    assert.equal(args.p_income.category, category);
    assert.equal(args.p_income.project, "Natale");
    assert.equal(args.p_movement, undefined);
    assert.equal(
      calls.some(
        (x) =>
          x.url.includes("association_movements") || x.url.includes("brevo"),
      ),
      false,
    );
  }
});
test("incasso automatico: importi o date non validi non registrano nulla", async () => {
  for (const invalid of [
    { amount: "0" },
    { amount: "-5" },
    { amount: "1.001" },
    { date: "2199-01-01" },
    { date: "2026-02-30" },
    { source: "other" },
    { confirmed: false },
    { payment: "other" },
  ]) {
    mock();
    const res = await POST(
      request({
        ...data,
        id,
        action: "issue",
        source: "new",
        amount: "25",
        date: "2026-10-20",
        confirmed: true,
        ...invalid,
      }),
    );
    assert.equal(res.status, 400);
    assert.equal(
      calls.some((x) => x.url.includes("/rpc/")),
      false,
    );
  }
});
