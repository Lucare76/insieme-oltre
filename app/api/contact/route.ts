import { createHash } from "node:crypto";
import { validateContact } from "../../../lib/contact";
import { contactMailConfig, sendContactMail } from "../../../lib/contactMail";
import { contactNotice } from "../../../lib/legal";

export const runtime = "nodejs";

// Best effort: per process, reset on cold start; not a distributed serverless quota.
const attempts = new Map<string, { count: number; expires: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_BODY_BYTES = 24000;
const reply = (status: number, message: string, headers: Record<string, string> = {}) =>
  Response.json({ message }, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reply(403, "Richiesta non consentita.");
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.expires <= now) attempts.delete(key);
  // Vercel overwrites x-vercel-forwarded-for; never trust client x-forwarded-for.
  const ip = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for") : null;
  const key = createHash("sha256").update(ip || "local-or-unknown").digest("hex");
  const entry = attempts.get(key) || { count: 0, expires: now + WINDOW_MS };
  if (entry.count >= 5 || (!attempts.has(key) && attempts.size >= 10000)) {
    return reply(429, "Troppe richieste. Riprova tra qualche minuto.", { "Retry-After": String(Math.ceil((entry.expires - now) / 1000)) });
  }
  entry.count++;
  attempts.set(key, entry);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply(415, "Formato non supportato.");
  let value: unknown;
  try {
    // Bound the streamed body too, without relying on a supplied Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return reply(400, "Compila i campi richiesti.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY_BYTES) { await reader.cancel(); return reply(413, "Messaggio troppo lungo."); }
      chunks.push(chunk.value);
    }
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return reply(400, "Richiesta non valida."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) return reply(400, "Richiesta non valida.");
  const website = (value as Record<string, unknown>).website;
  if (typeof website === "string" && website.trim()) return reply(200, "Grazie per il tuo messaggio.");
  const message = validateContact(value);
  if (!message) return reply(400, "Controlla i campi obbligatori e la Privacy Policy.");
  if (!contactNotice.published || !contactMailConfig()) return reply(503, "Il modulo non è ancora disponibile. Scrivici a info@insiemeoltreischia.it.");
  try {
    await sendContactMail(message);
    return reply(200, "Messaggio inviato. Ti ricontatteremo per conoscerci e capire insieme il prossimo passo.");
  } catch {
    return reply(503, "Non è stato possibile inviare il messaggio. Riprova più tardi oppure scrivici via email.");
  }
}
