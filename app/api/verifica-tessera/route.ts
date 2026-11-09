import { service } from "../../../lib/associationServer";
import { isMembershipCardValid, membershipCardCode, todayInRome } from "../../../lib/membershipCard";

export const runtime = "nodejs";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("codice");
  const year = Number(params.get("anno"));
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
      !Number.isInteger(year) || year < 2026 || year > 2100) {
    return Response.json({ valid: false, message: "Tessera non verificabile." }, { status: 400, headers });
  }
  try {
    // Identificativo UUID non enumerabile; mai esporre nome, CF o dati del socio.
    const res = await service(
      "/rest/v1/association_register_people?id=eq." + encodeURIComponent(id) +
      "&register_kind=eq.soci&select=admitted_on,ended_on&limit=1"
    );
    const rows = await res.json() as { admitted_on: string; ended_on: string | null }[];
    const valid = isMembershipCardValid(rows[0] ?? null, year, todayInRome());
    return Response.json({
      valid,
      year,
      code: membershipCardCode(id),
      message: valid ? "Tessera valida: socio iscritto nel Libro soci." : "Tessera non valida, scaduta o non verificabile."
    }, { headers });
  } catch {
    return Response.json({ valid: false, message: "Verifica temporaneamente non disponibile." }, { status: 503, headers });
  }
}
