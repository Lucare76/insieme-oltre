import { createHmac, timingSafeEqual } from "node:crypto";

export const WINDOW_MS = 24 * 60 * 60 * 1000;
export function windowOpen(lastInbound: string | null, now = Date.now()) {
  const timestamp = lastInbound ? Date.parse(lastInbound) : NaN;
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp < WINDOW_MS;
}
export function verifySignature(raw: Uint8Array, signature: string | null, secret: string) {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}
export function replyText(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 4096 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
    throw new Error("Scrivi un messaggio di massimo 4096 caratteri.");
  return value.trim();
}
type ObjectValue = Record<string, unknown>;
const object = (v: unknown): ObjectValue => v && typeof v === "object" && !Array.isArray(v) ? v as ObjectValue : {};
const array = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const str = (v: unknown, max = 4096) => typeof v === "string" ? v.replace(/\u0000/g, "").slice(0, max) : "";
export type Incoming = { meta_id: string; wa_id: string; name: string; sent_at: string; type: string; text: string; media_id: string | null; mime: string | null; filename: string | null };
export type Delivery = { meta_id: string; request_id: string | null; state: string; error_code: string | null };
export function webhookEvents(payload: unknown, phoneId: string, wabaId: string) {
  const incoming: Incoming[] = [], statuses: Delivery[] = [];
  if (object(payload).object !== "whatsapp_business_account") return { incoming, statuses };
  for (const item of array(object(payload).entry)) {
    const entry = object(item);
    if (entry.id !== wabaId) continue;
    for (const change of array(entry.changes)) {
      if (object(change).field !== "messages") continue;
      const value = object(object(change).value);
      if (object(value.metadata).phone_number_id !== phoneId) continue;
      for (const raw of array(value.messages)) {
        const m = object(raw), wa = str(m.from, 20), id = str(m.id, 300);
        const ts = Number(m.timestamp) * 1000;
        if (!/^\d{6,20}$/.test(wa) || !id || !Number.isFinite(ts) || ts <= 0 || ts > Date.now() + 60000) continue;
        const type = str(m.type, 30), media = object(m[type]);
        const contact = array(value.contacts).map(object).find(c => c.wa_id === wa);
        let text = type === "text" ? str(media.body) : str(media.caption);
        if (type === "button") text = str(media.text);
        if (type === "interactive") text = str(object(media.button_reply).title) || str(object(media.list_reply).title);
        if (type === "location") text = [str(media.name), str(media.address), String(media.latitude ?? ""), String(media.longitude ?? "")].filter(Boolean).join(" · ");
        incoming.push({ meta_id: id, wa_id: wa, name: str(object(contact?.profile).name, 120), sent_at: new Date(ts).toISOString(), type,
          text: text || (type === "contacts" ? "Contatto condiviso" : type === "reaction" ? "Reazione: " + str(media.emoji, 20) : "[" + type + "]"),
          media_id: ["image", "audio", "video", "document", "sticker"].includes(type) ? str(media.id, 300) || null : null,
          mime: str(media.mime_type, 120) || null, filename: str(media.filename, 180) || null });
      }
      for (const raw of array(value.statuses)) {
        const s = object(raw), state = str(s.status, 20);
        if (!["sent", "delivered", "read", "failed"].includes(state) || !str(s.id, 300)) continue;
        const requestId = str(s.biz_opaque_callback_data, 36);
        statuses.push({ meta_id: str(s.id, 300), request_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId) ? requestId : null, state,
          error_code: str(String(object(array(s.errors)[0]).code ?? ""), 40) || null });
      }
    }
  }
  return { incoming, statuses };
}
