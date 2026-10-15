import { createHash } from "node:crypto";
import { sendParticipationEmail } from "../../../lib/participationMail";
import { validateParticipation } from "../../../lib/participation";

export const runtime = "nodejs";
const WINDOW = 60 * 60 * 1000;
// QR condiviso durante eventi: molte persone possono usare lo stesso Wi-Fi.
const MAX_REQUESTS = 80;
const attempts = new Map<string, { n: number; until: number }>();
const respond = (status: number, message: string) => Response.json({ message }, {
  status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return respond(403, "Richiesta non consentita.");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return respond(415, "Formato non supportato.");

  const now = Date.now();
  for (const [ip, entry] of attempts) if (entry.until < now) attempts.delete(ip);
  const forwarded = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for") : null;
  const clientKey = createHash("sha256").update(forwarded || "unknown-client").digest("hex");
  const prev = attempts.get(clientKey) || { n: 0, until: now + WINDOW };
  if (prev.n >= MAX_REQUESTS || (!attempts.has(clientKey) && attempts.size > 10000)) return respond(429, "Troppe richieste. Riprova più tardi.");
  attempts.set(clientKey, { n: prev.n + 1, until: prev.until });

  let data: unknown;
  try {
    // Limite sull'effettivo corpo letto, non soltanto sul Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return respond(400, "Dati mancanti.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      bytes += r.value.byteLength;
      if (bytes > 3500) { await reader.cancel(); return respond(413, "Richiesta troppo lunga."); }
      chunks.push(r.value);
    }
    data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return respond(400, "Richiesta non valida."); }
  if (data && typeof data === "object" && !Array.isArray(data) &&
      (data as Record<string, unknown>).website) return respond(200, "Grazie per il contributo.");
  const value = validateParticipation(data);
  if (!value) return respond(400, "Controlla le risposte e conferma la lettura della Privacy Policy.");

  // Prima scelta: database. In assenza della migrazione, Brevo può ricevere la risposta.
  if (url && key) {
    try {
      const saved = await fetch(url + "/rest/v1/participation_submissions", {
        method: "POST",
        headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          role: value.role, age: value.age, interests: value.interests,
          need: value.need, times: value.times, obstacle: value.obstacle,
          contribution: value.contribution, idea: value.idea,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (saved.ok) return respond(200, "Grazie! La tua risposta è stata registrata.");
    } catch {
      // Il database non è raggiungibile; si tenta l'invio via email.
    }
  }

  const delivered = await sendParticipationEmail(value);
  if (delivered) return respond(200, "Grazie! La tua risposta è stata ricevuta dall'associazione.");
  return respond(503, "Il questionario è temporaneamente non disponibile per l'invio. Riprova tra qualche minuto.");
}
