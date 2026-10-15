import { contactMailConfig } from "./contactMail";
import { ages, contributions, needs, obstacles, priorities, roles, times, type Participation } from "./participation";

// Canale di riserva: le risposte arrivano all'indirizzo operativo già configurato.
// Non richiede un mittente o un recapito della persona che compila.
export async function sendParticipationEmail(data: Participation) {
  const config = contactMailConfig();
  if (!config) return false;
  const label = (value: string | null, values: readonly { value: string; label?: string; title?: string }[]) =>
    values.find((item) => item.value === value)?.label ||
    values.find((item) => item.value === value)?.title || "Non indicato";
  const lines = [
    "Nuova risposta al questionario Insieme Oltre",
    "",
    "Partecipa come: " + label(data.role, roles),
    "Fascia d'età: " + label(data.age, ages),
    "Attività preferite: " + data.interests.map((item) => label(item, priorities)).join(", "),
    "Difficoltà principale: " + label(data.need, needs),
    "Orari: " + (data.times.map((item) => label(item, times)).join(", ") || "Non indicato"),
    "Ostacolo: " + label(data.obstacle, obstacles),
    "Disponibilità a contribuire: " + label(data.contribution, contributions),
    "",
    "Suggerimento:",
    data.idea || "Nessuno",
    "",
    "Questionario senza nome, email o numero telefonico del partecipante.",
  ];
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": config.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Insieme Oltre - Questionario", email: config.from },
        to: [{ email: config.to }],
        subject: "Nuova risposta - questionario Insieme Oltre",
        textContent: lines.join("\n"),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
