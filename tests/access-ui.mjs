// UI QA with simulated API responses; no real accounts/emails are created.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs UI_BASE_URL=http://127.0.0.1:3102 node tests/access-ui.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const content = process.env.UI_CONTENT_BUILD
  ? createRequire(import.meta.url)(
      process.env.UI_CONTENT_BUILD + "/lib/siteContent.js",
    ).defaultHomeContent
  : null;
const server = process.env.UI_START_SERVER
  ? spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "-p",
        "3103",
        "-H",
        "127.0.0.1",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
  : null;
if (server) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch("http://127.0.0.1:3103/admin");
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
}
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const base = process.env.UI_BASE_URL || "http://127.0.0.1:3102";
const errors = [];
try {
  for (const width of [1366, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    let role = "owner",
      requested = false,
      approved = false;
    const user = () => ({
      id: "00000000-0000-0000-0000-000000000001",
      name: role === "owner" ? "Luca" : "Mario",
      role,
    });
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      let data = { ok: true };
      if (path.endsWith("/login"))
        data = {
          user: user(),
          session: {
            access_token: "test-token",
            refresh_token: "test-refresh",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        };
      else if (path.endsWith("/home-content"))
        data = { content, configured: true };
      else if (path.endsWith("/me")) data = { user: user() };
      else if (path.endsWith("/request")) {
        requested = true;
        data = {
          ok: true,
          message: "Richiesta ricevuta. Attendi l’approvazione.",
        };
      } else if (path.endsWith("/requests"))
        data = {
          emailReady: true,
          items: requested
            ? [
                {
                  id: "00000000-0000-0000-0000-000000000003",
                  name: "Mario Rossi",
                  email: "mario@example.org",
                  username: "mario.rossi",
                  status: approved ? "approved" : "pending",
                  created_at: "2026-10-20T10:00:00Z",
                  notification_sent_at: "2026-10-20T10:00:00Z",
                  invitation_sent_at: approved ? "2026-10-20T10:01:00Z" : null,
                },
              ]
            : [],
        };
      else if (path.endsWith("/review")) approved = true;
      else if (
        path.endsWith("/movements") ||
        path.endsWith("/members") ||
        path.endsWith("/audit")
      )
        data = { items: [] };
      else if (path.endsWith("/password"))
        data = {
          ok: true,
          message:
            "Password salvata. Ora puoi accedere con nome utente e password.",
        };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });
    await page.goto(base + "/admin");
    await page.getByRole("heading", { name: "Accedi", exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Richiedi accesso", exact: true })
      .click();
    await page
      .getByLabel("Nome e cognome", { exact: true })
      .fill("Mario Rossi");
    await page.locator("input[name=username]").last().fill("mario.rossi");
    await page.getByLabel("Email", { exact: true }).fill("mario@example.org");
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Invia richiesta", exact: true })
      .click();
    try {
      await page
        .getByText("Richiesta ricevuta. Attendi l’approvazione.")
        .waitFor({ timeout: 5000 });
    } catch (error) {
      console.log(await page.locator("body").innerText());
      console.log(
        await page
          .locator("input")
          .evaluateAll((xs) =>
            xs.map((x) => ({
              name: x.name,
              value: x.value,
              valid: x.checkValidity(),
              error: x.validationMessage,
            })),
          ),
      );
      console.log(errors);
      throw error;
    }
    assert.equal(requested, true);
    await page.getByLabel("Nome utente", { exact: true }).fill("luca");
    await page
      .getByLabel("Password", { exact: true })
      .fill("PasswordPerTest123!");
    await page.getByRole("button", { name: "Entra nell’area soci" }).click();
    await page.getByRole("heading", { name: "Benvenuto, Luca" }).waitFor();
    await page
      .getByRole("button", { name: /Richieste di accesso/ })
      .first()
      .click();
    await page
      .getByRole("heading", { name: "Richieste di accesso", exact: true })
      .waitFor();
    try {
      await page
        .locator("select[name=role]")
        .selectOption("accountant", { timeout: 5000 });
    } catch (error) {
      console.log(await page.locator("body").innerText());
      console.log(errors);
      throw error;
    }
    await page
      .getByRole("button", { name: "Approva e invia invito", exact: true })
      .click();
    await page.getByText("Richiesta approvata e invito inviato.").waitFor();
    assert.equal(approved, true);
    if (content) {
      await page
        .getByRole("button", { name: "Gestione sito", exact: true })
        .first()
        .click();
      await page.getByText("Testi caricati.", { exact: true }).waitFor();
    }
    await page
      .getByRole("button", { name: "Contabilità", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "+ Nuovo movimento", exact: true })
      .waitFor();
    await page.screenshot({
      path: "/tmp/insieme-admin-" + width + ".png",
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "overflow at " + width,
    );
    await page.getByRole("button", { name: "Esci", exact: true }).click();
    await page.getByRole("heading", { name: "Accedi", exact: true }).waitFor();
    role = "member";
    await page.getByLabel("Nome utente", { exact: true }).fill("mario.rossi");
    await page
      .getByLabel("Password", { exact: true })
      .fill("PasswordPerTest123!");
    await page.getByRole("button", { name: "Entra nell’area soci" }).click();
    await page.getByRole("heading", { name: "Benvenuto, Mario" }).waitFor();
    assert.equal(
      await page
        .getByRole("button", {
          name: /Richieste di accesso|Gestione sito|Utenti e permessi/,
        })
        .count(),
      0,
    );
    await page
      .getByRole("button", { name: "Contabilità", exact: true })
      .first()
      .click();
    await page.getByRole("heading", { name: "Entrate e uscite" }).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "+ Nuovo movimento", exact: true })
        .count(),
      0,
    );
    await page.goto(
      base + "/admin/imposta-password#token_hash=test-hash&type=invite",
    );
    await page
      .getByLabel("Nuova password", { exact: true })
      .fill("NuovaPassword123!");
    await page
      .getByLabel("Ripeti la password", { exact: true })
      .fill("NuovaPassword123!");
    assert.equal(new URL(page.url()).hash, "");
    await page
      .getByRole("button", { name: "Salva password", exact: true })
      .click();
    await page
      .getByText(
        "Password salvata. Ora puoi accedere con nome utente e password.",
      )
      .waitFor();
    await page.goto(base + "/area-soci");
    await page.waitForURL(base + "/admin");
    await context.close();
    console.log(
      "UI pass: request → owner approval → accounting → member permissions → password, width " +
        width,
    );
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  server?.kill();
}
