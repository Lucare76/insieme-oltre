import { authorize, service, jsonBody, AssociationError, privateHeaders, uuid } from "../../../../lib/associationServer";
import { isContactEmail } from "../../../../lib/contact";

export const runtime = "nodejs";
const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: privateHeaders });
const statuses = ["new", "contacted", "available", "active", "closed"] as const;
type Status = typeof statuses[number];

function stringField(value: unknown, maximum: number, required = false): string {
  if (typeof value !== "string" || value.trim().length > maximum || (required && !value.trim())) {
    throw new AssociationError("Controlla i campi della candidatura.");
  }
  return value.trim();
}

async function handle(request: Request) {
  await authorize(request, request.method !== "GET", true);
  if (request.method === "GET") {
    const result = await service("/rest/v1/association_volunteer_applications?select=id,name,email,phone,status,availability,notes,source,created_at,updated_at&order=created_at.desc&limit=500");
    return respond({ items: await result.json() });
  }
  if (request.method !== "POST") return respond({ error: "Metodo non consentito." }, 405);
  const body = await jsonBody(request);
  const id = body.id;
  if (id !== undefined && !uuid(id)) throw new AssociationError("Candidatura non valida.");
  const name = stringField(body.name, 120, true);
  const email = stringField(body.email, 254, true).toLowerCase();
  const phone = stringField(body.phone ?? "", 40);
  const availability = stringField(body.availability ?? "", 500);
  const notes = stringField(body.notes ?? "", 1000);
  if (!isContactEmail(email) || (phone && !/^[+\d\s().-]+$/.test(phone)))
    throw new AssociationError("Controlla email e telefono.");
  if (!statuses.includes(body.status as Status)) throw new AssociationError("Stato non valido.");
  const data = { name, email, phone, availability, notes, status: body.status, updated_at: new Date().toISOString() };
  if (id) {
    const result = await service("/rest/v1/association_volunteer_applications?id=eq." + encodeURIComponent(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data),
    });
    if (!(await result.json() as unknown[]).length) throw new AssociationError("Candidatura non trovata.", 404);
  } else {
    await service("/rest/v1/association_volunteer_applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, source: "manual" }),
    });
  }
  return respond({ ok: true });
}
async function dispatch(request: Request) {
  try { return await handle(request); }
  catch (error) {
    return respond({ error: error instanceof AssociationError ? error.message : "Servizio temporaneamente non disponibile." },
      error instanceof AssociationError ? error.status : 503);
  }
}
export { dispatch as GET, dispatch as POST };
