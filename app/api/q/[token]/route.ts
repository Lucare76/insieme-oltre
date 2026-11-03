import {
  AssociationError,
  jsonBody,
  privateHeaders,
  uuid,
} from "../../../../lib/associationServer";
import { rpc, submitLimit } from "../../../../lib/questionnaireServer";
export const runtime = "nodejs";

const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: privateHeaders });

/** Invio anonimo: nessun account, nessun IP salvato. La validazione completa è nel database. */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!/^[0-9a-f]{32}$/.test(token)) throw new AssociationError("Questionario non trovato.", 404);
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new AssociationError("Richiesta non consentita.", 403);
    // Nessun limite per singola risposta: solo un tetto tecnico complessivo (piattaforma ~4,5 MB).
    const body = await jsonBody(request, 4_000_000);
    if (body.website) return reply({ ok: true });
    if (!uuid(body.client_key) || !body.answers || typeof body.answers !== "object" || Array.isArray(body.answers))
      throw new AssociationError("Risposte non valide. Ricarica la pagina.");
    await submitLimit(request);
    await rpc<number>("qs_submit", { p_token: token, p_client_key: body.client_key, p_answers: body.answers });
    return reply({ ok: true });
  } catch (error) {
    const known = error instanceof AssociationError && error.status !== 503;
    return reply(
      { error: known ? error.message : "Invio non riuscito. Le risposte restano salvate su questo dispositivo: riprova tra poco." },
      known ? error.status : 503,
    );
  }
}
