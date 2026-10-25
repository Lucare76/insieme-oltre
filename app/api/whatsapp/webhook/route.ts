import { timingSafeEqual } from "node:crypto";
import { verifySignature, webhookEvents } from "../../../../lib/whatsapp";
import { metaConfig, waRpc } from "../../../../lib/whatsappServer";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  const supplied = p.get("hub.verify_token");
  if (!expected) return new Response("Webhook non configurato", { status: 503, headers });
  if (p.get("hub.mode") !== "subscribe" || !supplied || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
    return new Response("Verifica non valida", { status: 403, headers });
  return new Response(p.get("hub.challenge") ?? "", { headers });
}
export async function POST(request: Request) {
  const config = metaConfig(), secret = process.env.WHATSAPP_APP_SECRET;
  if (!config || !secret) return new Response("Webhook non configurato", { status: 503, headers });
  const reader = request.body?.getReader();
  if (!reader) return new Response("Payload mancante", { status: 400, headers });
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 2 * 1024 * 1024) { await reader.cancel(); return new Response("Payload troppo grande", { status: 413, headers }); }
    chunks.push(part.value);
  }
  const raw = Buffer.concat(chunks);
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), secret))
    return new Response("Firma non valida", { status: 401, headers });
  let payload: unknown;
  try { payload = JSON.parse(raw.toString("utf8")); } catch { return new Response("JSON non valido", { status: 400, headers }); }
  const events = webhookEvents(payload, config.phone, config.waba);
  try {
    for (const event of events.incoming) await waRpc("receive", { p_event: event });
    for (const event of events.statuses) await waRpc("delivery", {
      p_meta: event.meta_id, p_request: event.request_id, p_state: event.state, p_error: event.error_code,
    });
    return new Response("EVENT_RECEIVED", { headers });
  } catch {
    // Acknowledge only persisted events; Meta retries and message IDs deduplicate.
    return new Response("Archiviazione temporaneamente non disponibile", { status: 503, headers });
  }
}
