// Imported only by the server route. No credentials are passed to the client.
import { isContactEmail, type ContactMessage } from "./contact";

export function contactMailConfig() {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim();
  const to = process.env.CONTACT_TO_EMAIL?.trim() || "info@insiemeoltreischia.it";
  return apiKey && from && isContactEmail(from) && isContactEmail(to)
    ? { apiKey, from, to } : null;
}

export async function sendContactMail(message: ContactMessage) {
  const config = contactMailConfig();
  if (!config) throw new Error("Contact email unavailable");
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": config.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Insieme Oltre", email: config.from },
      to: [{ email: config.to }],
      replyTo: { email: message.email, name: message.name },
      subject: "Nuovo contatto dal sito Insieme Oltre",
      textContent: [
        `Nome e cognome: ${message.name}`, `Email: ${message.email}`,
        `Telefono: ${message.phone || "Non indicato"}`, `Sono: ${message.role}`,
        "Privacy Policy: accettata", "", message.message || "Nessun messaggio aggiunto.",
      ].join("\n"),
    }),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Contact email provider failed");
}
