// Production build, simulated APIs. No real accounts or accounting data are used.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/accounting-ui.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const shots = process.env.SCREENSHOT_DIR ?? tmpdir();
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
  for (const width of [1440, 820, 390, 360]) {
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
    const cancels = [];
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
          const b = route.request().postDataJSON();
          if (b.cancel_reason) {
            cancels.push(b);
            Object.assign(items.find((x) => x.id === b.id), {
              cancelled: true,
              cancellation_reason: b.cancel_reason,
            });
            await route.fulfill({ contentType: "application/json", body: "{}" });
            return;
          }
          saves++;
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
    const ledger = page.getByRole("region", { name: "Registro movimenti" });
    const countText = () => ledger.locator(".ledger-results-count").innerText();
    const totals = () => ledger.locator(".ledger-totals").innerText();
    const focused = (l) => l.evaluate((e) => e === document.activeElement);
    const noOverflow = async (state) =>
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `overflow ${width} ${state}`,
      );
    const reset = ledger.getByRole("button", { name: "Azzera filtri" });
    assert.equal(await countText(), "4 movimenti");
    assert.match(
      await totals(),
      /Entrate\s*50,00\s*€[\s\S]*Uscite\s*12,00\s*€[\s\S]*Saldo dei movimenti\s*38,00\s*€/,
    );
    assert.equal(await reset.count(), 0);
    assert.equal(await ledger.locator("table").isVisible(), width > 860);
    assert.equal(await ledger.locator(".ledger-cards").isVisible(), width <= 860);
    if (width > 860)
      assert.equal(
        await ledger
          .locator("th.ledger-num")
          .evaluate((e) => getComputedStyle(e).textAlign),
        "right",
      );
    await noOverflow("default");
    await ledger.getByLabel("Conto").selectOption("cash");
    assert.equal(await countText(), "2 movimenti"); // trasferimento e uscita in cassa
    assert.match(await totals(), /Entrate\s*0,00\s*€[\s\S]*Uscite\s*12,00\s*€/);
    assert.match(await dashboard.innerText(), /138,00/);
    await reset.waitFor();
    const download = page.waitForEvent("download");
    await ledger.getByRole("button", { name: "Esporta CSV" }).click();
    const csv = await download;
    assert.equal(csv.suggestedFilename(), "insieme-oltre-movimenti.csv");
    const csvText = await readFile(await csv.path(), "utf8");
    assert.ok(csvText.startsWith("﻿"));
    assert.deepEqual(csvText.slice(1).split("\r\n"), [
      '"Data";"Tipo";"Importo EUR";"Conto";"Categoria";"Iniziativa";"Causale";"Stato"',
      '"20/10/2026";"Trasferimento";"20,00";"Banca → Cassa";"Materiali";"Natale";"Prelievo per cassa";"Attivo"',
      '"20/10/2026";"Uscita";"12,00";"Cassa";"Materiali";"Natale";"Materiali laboratorio";"Attivo"',
    ]);
    const more = ledger.getByRole("button", { name: /^Altri filtri/ });
    assert.equal(await more.getAttribute("aria-expanded"), "false");
    assert.equal(await ledger.getByLabel("Tipo").isVisible(), false);
    await more.click();
    assert.equal(await more.getAttribute("aria-expanded"), "true");
    await ledger.getByLabel("Tipo").selectOption("expense");
    await ledger.getByLabel("Mostra annullati").check();
    assert.equal(await countText(), "1 movimento");
    await ledger.getByLabel("Conto").selectOption("");
    assert.equal(await countText(), "2 movimenti");
    assert.match(await totals(), /Uscite\s*12,00\s*€/); // annullato escluso
    assert.match(
      await ledger.locator(".is-cancelled").filter({ visible: true }).innerText(),
      /annullato[\s\S]*Escluso dai totali · Motivo: Registrazione errata/i,
    );
    await ledger.getByLabel("Mostra annullati").press("Escape");
    assert.equal(await more.getAttribute("aria-expanded"), "false");
    assert.ok(await focused(more));
    await ledger.getByRole("button", { name: "Altri filtri (2 attivi)" }).waitFor();
    const chips = ledger.getByRole("list", { name: "Altri filtri attivi" });
    assert.deepEqual(await chips.getByRole("button").allInnerTexts(), [
      "Tipo: Uscita ×",
      "Annullati visibili ×",
    ]);
    await noOverflow("chips");
    await ledger.screenshot({
      path: join(shots, `insieme-registro-filtri-${width}.png`),
    });
    await chips
      .getByRole("button", { name: "Rimuovi filtro Annullati visibili" })
      .click();
    assert.equal(await countText(), "1 movimento");
    assert.ok(await focused(more));
    await ledger.getByLabel("Cerca").fill("DONAZ");
    assert.equal(await countText(), "0 movimenti");
    await ledger.getByText("Nessun movimento corrisponde ai filtri selezionati.").waitFor();
    await reset.first().click();
    assert.equal(await countText(), "4 movimenti");
    assert.equal(await reset.count(), 0);
    assert.equal(await chips.count(), 0);
    await ledger.getByLabel("Cerca").fill("donaz");
    assert.equal(await countText(), "1 movimento");
    await reset.click();
    const info = ledger.getByRole("button", {
      name: "Come sono trattati i trasferimenti",
    });
    await info.click();
    await ledger.getByText(/I trasferimenti compaiono in entrambi i conti/).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await info.getAttribute("aria-expanded"), "false");
    assert.ok(await focused(info));
    await ledger.getByRole("button", { name: "Documenti: Donazione" }).waitFor();
    const actionsButton = ledger.getByRole("button", {
      name: "Azioni: Donazione, 20/10/2026",
    });
    await actionsButton.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    assert.ok(await focused(menu.getByRole("menuitem", { name: "Correggi" })));
    await page.keyboard.press("ArrowDown");
    assert.ok(
      await focused(menu.getByRole("menuitem", { name: "Annulla movimento…" })),
    );
    await noOverflow("menu");
    await page.keyboard.press("Escape");
    assert.equal(await menu.count(), 0);
    assert.ok(await focused(actionsButton));
    await actionsButton.click();
    await page.getByRole("heading", { name: "Totali dei movimenti filtrati" }).click();
    assert.equal(await menu.count(), 0, "click outside closes the menu");
    await actionsButton.click();
    await menu.getByRole("menuitem", { name: "Correggi" }).click();
    await page.getByRole("heading", { name: "Correggi movimento" }).waitFor();
    assert.equal(await page.locator("input[name=description]").inputValue(), "Donazione");
    await page.locator("#movement-editor").getByRole("button", { name: "Chiudi" }).click();
    page.once("dialog", (d) => d.dismiss());
    await actionsButton.click();
    await menu.getByRole("menuitem", { name: "Annulla movimento…" }).click();
    assert.deepEqual(cancels, [], "dismissed prompt must not write");
    page.once("dialog", (d) => d.accept("Registrazione di prova"));
    await actionsButton.click();
    await menu.getByRole("menuitem", { name: "Annulla movimento…" }).click();
    await ledger.locator(".ledger-results-count").getByText("3 movimenti").waitFor();
    assert.deepEqual(cancels, [
      { id: "income", version: 1, cancel_reason: "Registrazione di prova" },
    ]);
    assert.match(await totals(), /Entrate\s*0,00\s*€/);
    Object.assign(items.find((x) => x.id === "income"), {
      cancelled: false,
      cancellation_reason: null,
    });
    await page.getByRole("button", { name: "Aggiorna" }).click();
    await ledger.locator(".ledger-results-count").getByText("4 movimenti").waitFor();
    await page.screenshot({
      path: join(shots, `insieme-contabilita-${width}.png`),
      fullPage: true,
    });
    await ledger.screenshot({
      path: join(shots, `insieme-registro-${width}.png`),
    });
    await noOverflow("final");
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
      await page.getByRole("button", { name: /^Documenti/ }).count(),
      0,
    );
    assert.equal(await page.getByRole("button", { name: /^Azioni/ }).count(), 0);
    assert.equal(
      await page.getByRole("columnheader", { name: "Operazioni" }).count(),
      0,
    );
    assert.equal(await countText(), "5 movimenti"); // incluso il trasferimento salvato nel mock
    assert.match(await totals(), /Saldo dei movimenti\s*38,00\s*€/);
    await page.screenshot({
      path: join(shots, `insieme-contabilita-socio-${width}.png`),
      fullPage: true,
    });
    await noOverflow("member");
    await page.getByRole("button", { name: "Esci", exact: true }).click();
    role = "accountant";
    await login();
    await ledger.getByRole("button", { name: "Documenti: Donazione" }).waitFor();
    await actionsButton.click();
    assert.deepEqual(await menu.getByRole("menuitem").allInnerTexts(), [
      "Correggi",
      "Annulla movimento…",
    ]);
    await page.keyboard.press("Escape");
    assert.equal(
      await page.getByRole("button", { name: /^Richieste di accesso/ }).count(),
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
