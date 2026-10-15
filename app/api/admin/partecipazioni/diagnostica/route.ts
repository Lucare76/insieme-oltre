import { requireAdmin } from "../../../../../lib/adminAuth";
import { contactMailConfig } from "../../../../../lib/contactMail";

export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) {
    return Response.json({ error: "Non autorizzato." }, { status: 401, headers });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let database: "ok" | "not_configured" | "table_missing" | "connection_failed" | "access_denied" = "not_configured";

  if (url && key) {
    try {
      const response = await fetch(url + "/rest/v1/participation_submissions?select=id&limit=1", {
        headers: { apikey: key, Authorization: "Bearer " + key },
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      });
      if (response.ok) database = "ok";
      else if (response.status === 404) database = "table_missing";
      else if (response.status === 401 || response.status === 403) database = "access_denied";
      else database = "connection_failed";
    } catch {
      database = "connection_failed";
    }
  }

  // Solo segnali di stato: non restituisce credenziali, URL né indirizzi email.
  return Response.json({
    database,
    email: contactMailConfig() ? "configured" : "not_configured",
    note: "Una configurazione presente non prova che il provider accetti l'invio. Un invio di prova è necessario.",
  }, { headers });
}
