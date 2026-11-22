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
  const actor = await authorize(request, request.method !== "GET", true);
  if (request.method === "GET") {
    const result = await service("/rest/v1/association_volunteer_applications?select=id,name,email,phone,status,availability,notes,association_role,member_person_id,source,created_at,updated_at&order=created_at.desc&limit=500");
    return respond({ items: await result.json() });
  }
  if (request.method !== "POST") return respond({ error: "Metodo non consentito." }, 405);
  const body = await jsonBody(request);
  const id = body.id;
  if (body.action === "change_role") {
    if (!uuid(body.id) || !["socio", "socio_volontario"].includes(String(body.association_role)))
      throw new AssociationError("Seleziona un ruolo associativo valido.");
    const candidateResponse = await service(
      "/rest/v1/association_volunteer_applications?id=eq." + encodeURIComponent(body.id) +
      "&select=id,name,association_role,member_person_id&limit=1",
    );
    const [candidate] = await candidateResponse.json() as {
      id: string; name: string; association_role: string; member_person_id: string | null;
    }[];
    if (!candidate) throw new AssociationError("Candidatura non trovata.", 404);
    if (candidate.member_person_id) {
      // Non si cancella mai l'ammissione ufficiale tramite cambio ruolo.
      await service("/rest/v1/association_volunteer_applications?id=eq." + encodeURIComponent(candidate.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ association_role: body.association_role, updated_at: new Date().toISOString() }),
      });
      return respond({ ok: true, already_member: true });
    }
    const admittedOn = String(body.admitted_on ?? "");
    if (body.confirm_admission !== true || !/^\d{4}-\d{2}-\d{2}$/.test(admittedOn))
      throw new AssociationError("Conferma l'ammissione effettiva e la data.");
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
    if (admittedOn > today || admittedOn < "2000-01-01")
      throw new AssociationError("La data di ammissione non è valida.");
    const registered = await service(
      "/rest/v1/association_register_people?register_kind=eq.soci&ended_on=is.null&select=full_name&limit=3000",
    );
    const normalize = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("it-IT");
    const members = await registered.json() as { full_name: string }[];
    if (members.some(member => normalize(member.full_name) === normalize(candidate.name)))
      throw new AssociationError("Il nominativo è già nel Libro soci. Verifica prima di creare un duplicato.", 409);
    const created = await service("/rest/v1/rpc/association_promote_volunteer_to_member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        p_application: candidate.id, p_actor: actor.id,
        p_admitted_on: admittedOn, p_role: body.association_role,
      }),
    });
    return respond({ ok: true, person_id: await created.json() });
  }
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
