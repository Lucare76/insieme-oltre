import { contactMailConfig } from "./contactMail";
import { allowedAdminEmail } from "./adminAuth";
import { siteUrl } from "./siteUrl";
import { AssociationError } from "./associationServer";
export function accessMailReady() {
  return Boolean(contactMailConfig());
}
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function mailCard(title: string, body: string, button: string, href: string) {
  return `<!doctype html><html lang="it"><body style="margin:0;background:#f5f3ed;font-family:Arial,sans-serif;color:#25382c"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:100%;background:white;border-radius:18px;border:1px solid #dde4d7"><tr><td style="padding:30px"><img src="${escapeHtml(siteUrl)}/insieme-oltre-logo.png" alt="Insieme Oltre" width="132" style="display:block;margin-bottom:20px"><p style="font-size:12px;letter-spacing:2px;color:#66745f">AREA RISERVATA</p><h1 style="font-size:26px;line-height:1.25;margin:12px 0 18px">${escapeHtml(title)}</h1><div style="font-size:16px;line-height:1.7">${body}</div><p style="margin:28px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#345a43;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold">${escapeHtml(button)}</a></p><p style="font-size:12px;line-height:1.5;color:#66745f">Insieme Oltre ODV · L’amore non si misura in cromosomi.</p></td></tr></table></td></tr></table></body></html>`;
}
async function send(
  to: string,
  subject: string,
  textContent: string,
  htmlContent?: string,
) {
  const config = contactMailConfig();
  if (!config)
    throw new AssociationError(
      "Invio email non configurato. La richiesta resta disponibile nel pannello.",
      503,
    );
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": config.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Insieme Oltre", email: config.from },
      to: [{ email: to }],
      subject,
      textContent,
      ...(htmlContent ? { htmlContent } : {}),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const message =
      res.status === 401 || res.status === 403
        ? "Brevo ha rifiutato l’invio. Verifica la chiave API e il mittente autorizzato."
        : res.status === 400
          ? "Brevo non ha accettato l’email. Verifica che il mittente sia valido e verificato."
          : "Invio email non riuscito. Riprova tra poco.";
    throw new AssociationError(message, 503);
  }
  const result = await res.json().catch(() => ({}));
  return {
    messageId: typeof result.messageId === "string" ? result.messageId : null,
  };
}
export async function notifyAccessRequest(
  name: string,
  email: string,
  username: string,
) {
  return send(
    allowedAdminEmail(),
    "Nuova notifica: richiesta di accesso — Insieme Oltre",
    `${name} ha richiesto l’accesso all’area soci.\nEmail: ${email}\nNome utente: ${username}\n\nApri ${siteUrl}/admin e scegli Richieste di accesso per approvare e assegnare il ruolo oppure rifiutare.\nNessun accesso è stato ancora abilitato.`,
    mailCard(
      "Hai una nuova richiesta di accesso",
      `<p><strong>${escapeHtml(name)}</strong> ha richiesto l’accesso all’area riservata.</p><p>Email: ${escapeHtml(email)}<br>Nome utente: <strong>${escapeHtml(username)}</strong></p><p>Apri il pannello per esaminare la richiesta e scegliere il ruolo. Fino alla tua approvazione non è consentito alcun accesso.</p>`,
      "Apri le richieste",
      `${siteUrl}/admin`,
    ),
  );
}
export async function sendAccessLink(
  email: string,
  name: string,
  username: string,
  hash: string,
  type: "invite" | "recovery",
) {
  const link = `${siteUrl}/admin/imposta-password#${new URLSearchParams({ token_hash: hash, type })}`;
  await send(
    email,
    "Imposta la password — Insieme Oltre",
    `Ciao ${name},\n\nPuoi impostare la password del tuo account Insieme Oltre aprendo questo collegamento personale e monouso:\n${link}\n\nNome utente: ${username}\nAccesso: ${siteUrl}/admin\n\nSe il collegamento è scaduto usa “Password dimenticata?” dalla pagina di accesso. Se non hai richiesto questa operazione puoi ignorare l’email.`,
  );
}

export async function sendNotificationTest() {
  return send(
    allowedAdminEmail(),
    "Prova avvisi email — Insieme Oltre",
    `Gli avvisi email per le nuove richieste di accesso sono configurati per questo indirizzo.\nApri ${siteUrl}/admin per gestire le richieste.\nQuesta è un’email di prova: non è stata creata né approvata alcuna richiesta.`,
    mailCard(
      "Gli avvisi arrivano qui",
      `<p>Questa è un’email di prova dell’area riservata.</p><p>Quando arriva una nuova richiesta di accesso, invieremo un avviso a questo indirizzo. La richiesta sarà disponibile anche nel pannello.</p>`,
      "Apri il pannello",
      `${siteUrl}/admin`,
    ),
  );
}
