import { AssociationError, privateHeaders, service, uuid } from "../../../../../lib/associationServer";
import { authorizeWhatsapp, metaConfig, metaRequest, waError } from "../../../../../lib/whatsappServer";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await authorizeWhatsapp(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!uuid(id)) throw new AssociationError("Allegato non valido.");
    const [message] = await (await service("/rest/v1/wa_messages?id=eq." + id + "&select=media_id,filename")).json();
    if (!message?.media_id) throw new AssociationError("Allegato non trovato.", 404);
    const config = metaConfig();
    if (!config) throw new AssociationError("Collegamento Meta da configurare.", 503);
    const infoResponse = await metaRequest(encodeURIComponent(message.media_id));
    if (!infoResponse.ok) throw new AssociationError("Allegato non più disponibile su Meta.", 410);
    const info = await infoResponse.json();
    let url: URL;
    try { url = new URL(info.url); } catch { throw new AssociationError("Indirizzo allegato non valido.", 503); }
    if (url.protocol !== "https:" || !["lookaside.fbsbx.com", "lookaside.facebook.com"].includes(url.hostname))
      throw new AssociationError("Origine allegato non consentita.", 503);
    const maximum = 4 * 1024 * 1024;
    if (Number(info.file_size) > maximum) throw new AssociationError("Questo allegato supera il limite di download di 4 MB.", 413);
    const response = await fetch(url, { headers: { Authorization: "Bearer " + config.token },
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok || !response.body) throw new AssociationError("Download non disponibile.", 503);
    const chunks: Uint8Array[] = []; let size = 0;
    const reader = response.body.getReader();
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new AssociationError("Allegato oltre 4 MB.", 413); }
      chunks.push(next.value);
    }
    return new Response(Buffer.concat(chunks), { headers: { ...privateHeaders, "Content-Type": "application/octet-stream",
      "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(message.filename || "allegato-whatsapp") } });
  } catch (e) { return waError(e); }
}
