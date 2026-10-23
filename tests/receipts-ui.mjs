// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs UI_BASE_URL=http://127.0.0.1:3108 node tests/receipts-ui.mjs
// All account, movement, receipt and email responses are simulated locally.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const server = process.env.UI_START_SERVER
  ? spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "-p",
        "3111",
        "-H",
        "127.0.0.1",
      ],
      { stdio: "ignore" },
    )
  : null;
const base =
  process.env.UI_BASE_URL ||
  (server ? "http://127.0.0.1:3111" : "http://127.0.0.1:3108");
if (server) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(base + "/admin")).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.UI_BROWSER_EXECUTABLE_PATH
    ? { executablePath: process.env.UI_BROWSER_EXECUTABLE_PATH }
    : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  for (const { width, mode } of [1366, 390].flatMap((width) =>
    ["archive", "direct", "failure"].map((mode) => ({ width, mode })),
  )) {
    const context = await browser.newContext({
      viewport: { width, height: 960 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let role = "accountant",
      incomes = [],
      receipts = [],
      sends = 0,
      issues = 0;
    await context.addInitScript(() => {
      localStorage.setItem(
        "insieme_oltre_admin_session",
        JSON.stringify({
          access_token: "test",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
      );
      localStorage.setItem(
        "insieme_oltre_admin_session_times",
        JSON.stringify({ loginAt: Date.now(), lastActivityAt: Date.now() }),
      );
    });
    await page.route("**/api/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      let body = {};
      if (url.pathname.endsWith("/me"))
        body = { user: { id: "test", name: "Responsabile", role } };
      else if (url.pathname.endsWith("/movements")) body = { items: incomes };
      else if (url.pathname.endsWith("/ricevute")) {
        if (req.method() === "GET")
          body = { items: receipts, configured: true, mail_ready: true };
        else {
          const input = req.postDataJSON();
          if (input.action === "preview")
            return route.fulfill({
              contentType: "application/pdf",
              body: "%PDF-local-preview",
            });
          if (input.action === "issue") {
            issues++;
            receipts = [
              {
                id: input.id,
                number: 1,
                issued_on: "2026-10-23",
                movement_id: input.movement_id,
                data: input,
                amount_cents: 60000,
                cancelled: false,
                mail_status: "pending",
                sent_at: null,
              },
            ];
            body = { number: 1, id: input.id };
          } else if (input.action === "send") {
            sends++;
            assert.equal(
              input.confirm_email,
              receipts[0].data.email.trim().toLowerCase(),
            );
            if (mode === "failure")
              return route.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({
                  error: "Invio email non riuscito. La ricevuta è salvata.",
                }),
              });
            receipts[0].mail_status = "sent";
            body = { ok: true };
          }
        }
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    await page.goto(base + "/area-soci");
    await page.getByRole("button", { name: "Ricevute", exact: true }).click();
    await page.getByText("Nessuna ricevuta emessa.", { exact: true }).waitFor();
    assert.ok(
      await page.getByRole("button", { name: "+ Nuova ricevuta" }).isDisabled(),
    );
    assert.equal(sends, 0);
    await page.screenshot({
      path: `/tmp/ricevute-vuoto-${width}.png`,
      fullPage: true,
    });
    incomes = [
      {
        id: "00000000-0000-0000-0000-000000000001",
        date: "2026-10-20",
        amount_cents: 60000,
        kind: "income",
        account: "bank",
        description: "Incasso locale simulato",
        version: 1,
        cancelled: false,
      },
    ];
    await page.getByRole("button", { name: "Aggiorna", exact: true }).click();
    await page.getByRole("button", { name: "+ Nuova ricevuta" }).click();
    assert.ok(
      await page
        .getByRole("button", { name: "Emetti e invia via email", exact: true })
        .isDisabled(),
    );
    await page.getByLabel("Incasso registrato").selectOption(incomes[0].id);
    await page.getByLabel("Tipo di documento").selectOption("fundraising");
    await page
      .getByLabel("Nome e cognome / ragione sociale")
      .fill("Agenzia esempio");
    await page.getByLabel("Codice fiscale / partita IVA").fill("12345678901");
    await page.getByLabel("Indirizzo completo").fill("Via Esempio 1, Ischia");
    await page.getByLabel("Email del versante").fill("Prova@Example.org");
    await page.getByLabel("Riferimento pagamento").fill("TRN esempio");
    await page
      .getByLabel("Iniziativa, quantità")
      .fill("Raccolta fondi Natale: 30 panettoni");
    await page.getByRole("checkbox").check();
    assert.ok(
      await page
        .getByRole("button", { name: "Emetti ricevuta", exact: true })
        .isDisabled(),
    );
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Scarica anteprima PDF" }).click();
    await downloaded;
    assert.equal(issues, 0);
    assert.equal(sends, 0);
    await page
      .getByRole("button", { name: "Emetti ricevuta", exact: true })
      .waitFor({ state: "visible" });
    await page.screenshot({
      path: `/tmp/ricevute-modulo-${width}.png`,
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page
      .getByRole("button", {
        name:
          mode === "archive" ? "Emetti ricevuta" : "Emetti e invia via email",
        exact: true,
      })
      .click();
    await page.getByText("Agenzia esempio", { exact: true }).waitFor();
    assert.equal(issues, 1);
    if (mode === "archive") {
      assert.equal(sends, 0);
      await page
        .getByRole("button", { name: "Invia email", exact: true })
        .click();
      await page
        .getByLabel("Riscrivi l’indirizzo per confermare")
        .fill("prova@example.org");
      await page
        .getByRole("button", { name: "Conferma e invia email" })
        .click();
    }
    if (mode === "failure") {
      await page
        .getByRole("status")
        .filter({ hasText: "emessa e salvata" })
        .waitFor();
      await page.getByText("Da inviare", { exact: true }).waitFor();
      assert.equal(receipts.length, 1);
      assert.equal(
        await page
          .getByRole("button", {
            name: "Emetti e invia via email",
            exact: true,
          })
          .count(),
        0,
      );
    } else {
      await page.getByText("Accettata da Brevo", { exact: true }).waitFor();
    }
    assert.equal(sends, 1);
    role = "member";
    await page.reload();
    await page
      .getByRole("button", { name: "Contabilità", exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Ricevute", exact: true }).count(),
      0,
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    "Ricevute: desktop e mobile, invio diretto e separato, errore email senza doppia emissione, anteprima e permessi verificati.",
  );
} finally {
  await browser.close();
  server?.kill();
}
