import { contactMailConfig } from "./contactMail";
import { allowedAdminEmail } from "./adminAuth";
import { siteUrl } from "./siteUrl";
import { AssociationError } from "./associationServer";
export function accessMailReady() {
  return Boolean(contactMailConfig());
}
async function send(to: string, subject: string, textContent: string) {
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
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok)
    throw new AssociationError(
      "Invio email non riuscito. Puoi riprovare dal pannello.",
      503,
    );
}
export async function notifyAccessRequest(
  name: string,
  email: string,
  username: string,
) {
  await send(
    allowedAdminEmail(),
    "Nuova richiesta di accesso — Insieme Oltre",
    `${name} ha richiesto l’accesso all’area soci.\nEmail: ${email}\nNome utente: ${username}\n\nApri ${siteUrl}/admin e scegli Richieste di accesso per approvare e assegnare il ruolo oppure rifiutare.\nNessun accesso è stato ancora abilitato.`,
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
