import { authorize, AssociationError, jsonBody, service, uuid } from "../../../../lib/associationServer";
import { replyText, windowOpen } from "../../../../lib/whatsapp";
import { authorizeWhatsapp, metaConfig, metaRequest, sendingEnabled, waError, waReply, waRpc } from "../../../../lib/whatsappServer";
export const runtime = "nodejs";
const conversationFields = "id,wa_id,contact_name,last_inbound_at,last_message_at,last_preview,unread_count,status,assigned_to,version";
const messageFields = "id,conversation_id,direction,type,body,media_id,mime,filename,sent_at,created_at,state,error_code,actor_id";
const limit = () => Math.min(1000, Math.max(1, Number(process.env.WHATSAPP_MONTHLY_LIMIT) || 950));
async function handle(request: Request) {
  const params = new URL(request.url).searchParams;
  if (request.method === "GET" && params.get("view") === "access") {
    const user = await authorize(request);
    if (user.role === "owner") return waReply({ allowed: true });
    const [grant] = await (await service("/rest/v1/wa_operators?user_id=eq." + user.id + "&enabled=eq.true&select=user_id")).json();
    return waReply({ allowed: Boolean(grant) });
  }
  const user = await authorizeWhatsapp(request);
  if (request.method === "GET") {
    if (params.get("view") === "operators") {
      if (user.role !== "owner") throw new AssociationError("Gestione riservata all’amministratore.", 403);
      const [members, grants] = await Promise.all([
        service("/rest/v1/association_members?select=user_id,name,active,activated_at&order=name&limit=1000").then(r => r.json()),
        service("/rest/v1/wa_operators?select=user_id,enabled").then(r => r.json()),
      ]);
      return waReply({ members, grants });
    }
    const conversation = params.get("conversation");
    if (conversation) {
      if (!uuid(conversation)) throw new AssociationError("Conversazione non valida.");
      let before = "";
      if (params.has("before")) {
        const date = params.get("before")!;
        const beforeId = params.get("before_id");
        if (!Number.isFinite(Date.parse(date)) || !uuid(beforeId)) throw new AssociationError("Pagina non valida.");
        const stamp = new Date(date).toISOString();
        before = "&or=" + encodeURIComponent("(created_at.lt." + stamp + ",and(created_at.eq." + stamp + ",id.lt." + beforeId + "))");
      }
      const items = await (await service("/rest/v1/wa_messages?conversation_id=eq." + conversation + "&select=" + messageFields + before + "&order=created_at.desc,id.desc&limit=100")).json();
      return waReply({ items: items.reverse(), has_more: items.length === 100 });
    }
    const offset = Math.max(0, Math.min(100000, Math.floor(Number(params.get("offset")) || 0)));
    const [conversations, stats] = await Promise.all([
      service("/rest/v1/wa_conversations?select=" + conversationFields + "&order=last_message_at.desc,id&limit=50&offset=" + offset).then(r => r.json()),
      waRpc("usage", {}),
    ]);
    return waReply({ conversations, has_more: conversations.length === 50, usage: stats, limit: limit(),
      connected: Boolean(metaConfig() && process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN),
      send_enabled: sendingEnabled(), user_id: user.id });
  }
  const body = await jsonBody(request);
  if (body.action === "operator") {
    if (user.role !== "owner") throw new AssociationError("Gestione riservata all’amministratore.", 403);
    if (!uuid(body.user_id) || typeof body.enabled !== "boolean") throw new AssociationError("Utente non valido.");
    const result = await waRpc("set_operator", { p_user: body.user_id, p_enabled: body.enabled, p_actor: user.id });
    if (result.error) throw new AssociationError(result.error, 409);
    return waReply(result);
  }
  if (!uuid(body.conversation_id)) throw new AssociationError("Conversazione non valida.");
  if (body.action === "manage") {
    if (!Number.isInteger(body.version) || !["open", "assigned", "closed", "read"].includes(String(body.status)))
      throw new AssociationError("Operazione non valida.");
    const result = await waRpc("manage", { p_id: body.conversation_id, p_version: body.version, p_status: body.status, p_actor: user.id });
    if (result.error) throw new AssociationError(result.error, 409);
    return waReply(result);
  }
  if (body.action !== "send" || !uuid(body.request_id)) throw new AssociationError("Invio non valido.");
  const config = metaConfig();
  if (!config || !sendingEnabled()) throw new AssociationError("Invio WhatsApp non ancora attivato.", 503);
  let text: string;
  try { text = replyText(body.text); } catch (e) { throw new AssociationError((e as Error).message); }
  const [conversation] = await (await service("/rest/v1/wa_conversations?id=eq." + body.conversation_id + "&select=last_inbound_at")).json();
  if (!conversation || !windowOpen(conversation.last_inbound_at))
    throw new AssociationError("Finestra di risposta chiusa. Attendi un nuovo messaggio.", 409);
  const reservation = await waRpc("reserve", {
    p_id: body.request_id, p_conversation: body.conversation_id, p_actor: user.id, p_owner: user.role === "owner",
    p_body: text, p_limit: limit(),
  });
  if (reservation.error) throw new AssociationError(reservation.error, 409);
  let response: Response;
  try {
    response = await metaRequest(config.phone + "/messages", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: reservation.wa_id,
        type: "text", text: { body: text, preview_url: false }, biz_opaque_callback_data: body.request_id }) });
  } catch {
    await waRpc("delivery", { p_meta: null, p_request: body.request_id, p_state: "unknown", p_error: "network" }).catch(() => undefined);
    throw new AssociationError("Invio con esito da verificare: non reinviare il messaggio. Attendi l’aggiornamento da Meta.", 503);
  }
  const result = await response.json().catch(() => null);
  const metaId = result?.messages?.[0]?.id;
  const accepted = response.ok && typeof metaId === "string";
  // 5xx/malformed replies are ambiguous: never retry automatically.
  const state = accepted ? "accepted" : response.status >= 400 && response.status < 500 ? "failed" : "unknown";
  await waRpc("delivery", { p_meta: accepted ? metaId : null, p_request: body.request_id,
    p_state: state, p_error: accepted ? null : String(result?.error?.code ?? response.status) });
  if (!accepted) throw new AssociationError(state === "unknown" ? "Esito da verificare su Meta. Non reinviare." : "Meta ha rifiutato il messaggio. Verifica lo stato e la configurazione.", 503);
  return waReply({ ok: true, state: "accepted" });
}
async function dispatch(request: Request) { try { return await handle(request); } catch (e) { return waError(e); } }
export { dispatch as GET, dispatch as POST };
