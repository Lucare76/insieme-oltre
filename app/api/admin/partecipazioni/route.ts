import { requireAdmin } from "../../../../lib/adminAuth";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return Response.json({ error: "Accesso non autorizzato." }, { status: 401, headers });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "Supabase non configurato." }, { status: 503, headers });
  try {
    const response = await fetch(url + "/rest/v1/participation_submissions?select=id,created_at,role,age,interests,idea&order=created_at.desc&limit=500", {
      headers: { apikey: key, Authorization: "Bearer " + key, Prefer: "count=exact" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return Response.json({ error: "Impossibile leggere le risposte. Verifica la migrazione del database." }, { status: 503, headers });
    const items = await response.json();
    const count = Number(response.headers.get("content-range")?.split("/")?.[1]);
    return Response.json({ items, total: Number.isFinite(count) ? count : items.length, limited: items.length >= 500 }, { headers });
  } catch { return Response.json({ error: "Servizio non disponibile." }, { status: 503, headers }); }
}
