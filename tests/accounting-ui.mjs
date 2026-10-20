// Production build, simulated APIs. No real accounts or accounting data are used.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/accounting-ui.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3105", "-H", "127.0.0.1"],
  { stdio: "pipe" },
);
let logs = "";
server.stderr.on("data", (x) => (logs += x));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
let browser;
try {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch("http://127.0.0.1:3105/admin")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  for (const width of [1366, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let role = "owner",
      uploads = 0,
      saves = 0;
    const base = {
      date: "2026-10-20",
      category: "Materiali",
      project: "Natale",
      description: "Materiali laboratorio",
      version: 1,
      cancelled: false,
      cancellation_reason: null,
      account: "bank",
    };
    const items = [
      {
        ...base,
        id: "opening",
        date: "2025-12-01",
        kind: "opening",
        amount_cents: 10000,
        description: "Saldo iniziale",
      },
      {
        ...base,
        id: "income",
        kind: "income",
        category: "Donazioni",
        amount_cents: 5000,
        description: "Donazione",
      },
      {
        ...base,
        id: "transfer",
        kind: "transfer",
        amount_cents: 2000,
        description: "Prelievo per cassa",
      },
      {
        ...base,
        id: "expense",
        account: "cash",
        kind: "expense",
        amount_cents: 1200,
      },
      {
        ...base,
        id: "cancelled",
        kind: "expense",
        amount_cents: 99000,
        cancelled: true,
        cancellation_reason: "Registrazione errata",
      },
    ];
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let data = { ok: true };
      let status = 200;
      if (path.endsWith("/login"))
        data = {
          user: { id: "owner", name: "Luca", role },
          session: {
            access_token: "test",
            expires_at: Date.now() / 1000 + 3600,
          },
        };
      else if (path.endsWith("/requests")) data = { items: [] };
      else if (path.endsWith("/movements")) {
        if (route.request().method() === "GET") data = { items };
        else {
          saves++;
          const b = route.request().postDataJSON();
          items.unshift({
            ...base,
            ...b,
            id: "new",
            amount_cents: 1000,
            version: 1,
          });
          data = { ok: true, id: "new" };
        }
      } else if (path.endsWith("/documents")) {
        if (route.request().method() === "GET") data = { items: [] };
        else {
          uploads++;
          if (uploads === 1) {
            status = 503;
            data = { error: "Document temporairement indisponible" };
          }
        }
      }
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });
    const login = async () => {
      await page.goto("http://127.0.0.1:3105/admin");
      await page.getByLabel("Nome utente", { exact: true }).fill("luca");
      await page
        .getByLabel("Password", { exact: true })
        .fill("PasswordPerTest123!");
      await page.getByRole("button", { name: "Entra nell’area soci" }).click();
      await page
        .getByRole("button", { name: "Contabilità", exact: true })
        .click();
      await page.getByLabel("Anno del riepilogo").selectOption("2026");
      await page.getByText("138,00", { exact: false }).first().waitFor();
    };
    await login();
    const dashboard = page.getByRole("region", {
      name: "Cruscotto contabilità",
    });
    assert.match(await dashboard.innerText(), /50,00/);
    assert.match(await dashboard.innerText(), /12,00/);
    await page.getByText("Leggi gli importi mensili").click();
    const oct = dashboard.getByRole("row").filter({ hasText: "Ott" });
    assert.match(await oct.innerText(), /50,00.*12,00.*38,00/s);
    await page.getByText("Leggi gli importi mensili").click();
    const filters = page.locator(".soci-filters");
    await filters.locator("select").nth(2).selectOption("cash");
    const register = page.locator("table").last();
    assert.equal(await register.getByRole("row").count(), 3); // header, transfer, expense
    assert.match(await dashboard.innerText(), /138,00/);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Esporta i movimenti/ }).click();
    const csv = await download;
    assert.equal(csv.suggestedFilename(), "insieme-oltre-movimenti.csv");
    await page.getByRole("button", { name: "Azzera filtri" }).click();
    await page.screenshot({
      path: `/tmp/insieme-contabilita-${width}.png`,
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow ${width}`,
    );
    await page
      .getByRole("button", { name: "− Registra uscita", exact: true })
      .click();
    assert.equal(
      await page.locator("select[name=kind]").inputValue(),
      "expense",
    );
    await page.locator("select[name=kind]").selectOption("transfer");
    await page.locator("select[name=account]").selectOption("cash");
    await page.getByText("Al conto:").waitFor();
    assert.match(
      await page.locator(".accounting-transfer").innerText(),
      /Conto bancario/,
    );
    await page.locator("input[name=amount]").fill("10,00");
    await page.locator("input[name=category]").fill("Trasferimento interno");
    await page
      .locator("input[name=description]")
      .fill("Versamento dalla cassa");
    await page
      .getByRole("button", { name: "Salva e allega documento" })
      .click();
    await page
      .getByRole("heading", { name: "Documenti · Versamento dalla cassa" })
      .waitFor();
    assert.equal(saves, 1);
    await page.locator("input[type=file]").setInputFiles({
      name: "ricevuta.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nexample"),
    });
    await page
      .getByRole("button", { name: "Allega documento", exact: true })
      .click();
    await page.getByText("Document temporairement indisponible").waitFor();
    await page
      .getByRole("button", { name: "Allega documento", exact: true })
      .click();
    await page.waitForTimeout(150);
    assert.equal(uploads, 2);
    assert.equal(saves, 1, "retry upload must not create a duplicate movement");
    await page.getByRole("button", { name: "Esci", exact: true }).click();
    role = "member";
    await login();
    assert.equal(
      await page.getByRole("button", { name: "+ Nuovo movimento" }).count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Documenti", exact: true })
        .count(),
      0,
    );
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `Accounting UI ${width}: reports, filters, transfer, upload retry, member permissions OK`,
    );
  }
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  await browser?.close();
  server.kill();
}
