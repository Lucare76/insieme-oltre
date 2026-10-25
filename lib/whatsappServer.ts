import { authorize, service, AssociationError, privateHeaders } from "./associationServer";
export const waReply = (body: unknown, status = 200) => Response.json(body, { status, headers: privateHeaders });
export async function waRpc(name: string, args: Record<string, unknown>) {
  const r = await service("/rest/v1/rpc/wa_" + name, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args),
  });
  return r.json();
}
export function metaConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phone = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
  const version = process.env.WHATSAPP_GRAPH_VERSION?.trim();
  return token && phone && /^\d+$/.test(phone) && waba && /^\d+$/.test(waba) && version && /^v\d+\.0$/.test(version)
    ? { token, phone, waba, version } : null;
}
export const sendingEnabled = () => process.env.WHATSAPP_SEND_ENABLED === "true";
export async function authorizeWhatsapp(request: Request, ownerOnly = false) {
  const user = await authorize(request, false, ownerOnly);
  if (user.role !== "owner") {
    const [grant] = await (await service("/rest/v1/wa_operators?user_id=eq." + user.id + "&enabled=eq.true&select=user_id")).json();
    if (!grant) throw new AssociationError("Non sei abilitato alla casella WhatsApp.", 403);
  }
  return user;
}
export function waError(error: unknown) {
  return waReply({ error: error instanceof AssociationError ? error.message : "WhatsApp temporaneamente non disponibile." },
    error instanceof AssociationError ? error.status : 503);
}
export async function metaRequest(endpoint: string, init: RequestInit = {}) {
  const c = metaConfig();
  if (!c) throw new AssociationError("Collegamento Meta da configurare.", 503);
  return fetch("https://graph.facebook.com/" + c.version + "/" + endpoint, {
    ...init, headers: { Authorization: "Bearer " + c.token, ...init.headers }, cache: "no-store",
    signal: AbortSignal.timeout(15000), redirect: "error",
  });
}
