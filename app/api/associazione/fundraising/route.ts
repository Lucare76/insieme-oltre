import { authorize, service, jsonBody, privateHeaders, AssociationError } from "../../../../lib/associationServer";
import { validDate, parseCents } from "../../../../lib/accounting";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: privateHeaders });
const validProduct = (x: unknown): x is "panettone" | "candela" => x === "panettone" || x === "candela";
const validProject = (x: unknown): x is string =>
  typeof x === "string" && x.trim().length > 0 && x.length <= 120;
function validateProject(x: unknown) {
  if (!validProject(x)) throw new AssociationError("Seleziona un'iniziativa valida.");
  return x.trim();
}
async function handle(request: Request) {
  const write = request.method !== "GET";
  const user = await authorize(request, write, false, false, !write);
  if (request.method === "GET") {
    const project = validateProject(new URL(request.url).searchParams.get("project"));
    const p = encodeURIComponent(project);
    const [stocks, sales] = await Promise.all([
      service(`/rest/v1/association_fundraising_stock?project=eq.${p}&select=project,product,total_units,min_price_cents&order=product`),
      service(`/rest/v1/association_fundraising_sales?project=eq.${p}&select=id,product,quantity,amount_cents,volunteer,sale_date,account,cancelled_at,created_at&order=created_at.desc&limit=1000`),
    ]);
    return reply({ stock: await stocks.json(), sales: await sales.json() });
  }
  if (request.method !== "POST") throw new AssociationError("Metodo non consentito.", 405);
  const b = await jsonBody(request);
  const project = validateProject(b.project);
  if (!validProduct(b.product)) throw new AssociationError("Prodotto non valido.");
  if (b.action === "stock") {
    if (!Number.isInteger(b.units) || Number(b.units) < 0 || Number(b.units) > 1000000)
      throw new AssociationError("Indica una quantità totale valida.");
    await service("/rest/v1/rpc/association_fundraising_stock_set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_project: project, p_product: b.product, p_units: b.units, p_actor: user.id }),
    });
    return reply({ ok: true });
  }
  if (b.action === "sell") {
    if (!Number.isInteger(b.quantity) || Number(b.quantity) < 1 || Number(b.quantity) > 10000 ||
        !validDate(b.date) || !["cash", "bank"].includes(String(b.account)) ||
        typeof b.volunteer !== "string" || !b.volunteer.trim() || b.volunteer.length > 120)
      throw new AssociationError("Controlla quantità, data, volontario e conto.");
    const cents = parseCents(b.amount);
    if (!cents) throw new AssociationError("Importo non valido.");
    const res = await service("/rest/v1/rpc/association_fundraising_sell", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_project: project, p_product: b.product, p_quantity: b.quantity,
        p_amount: cents, p_volunteer: b.volunteer.trim(), p_date: b.date,
        p_account: b.account, p_actor: user.id }),
    });
    return reply({ ok: true, id: await res.json() });
  }
  if (b.action === "cancel") {
    if (typeof b.sale_id !== "string" || !/^[a-f0-9-]{36}$/i.test(b.sale_id) ||
        typeof b.reason !== "string" || b.reason.trim().length < 10 || b.reason.length > 500)
      throw new AssociationError("Per annullare indica una motivazione di almeno 10 caratteri.");
    // Verify the chosen sale belongs to the requested collection before mutating.
    const res = await service("/rest/v1/association_fundraising_sales?id=eq." +
      encodeURIComponent(b.sale_id) + "&project=eq." + encodeURIComponent(project) + "&product=eq." +
      encodeURIComponent(b.product) + "&select=id&limit=1");
    if (!(await res.json()).length) throw new AssociationError("Consegna non trovata.", 404);
    await service("/rest/v1/rpc/association_fundraising_cancel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_id: b.sale_id, p_actor: user.id, p_reason: b.reason.trim() }),
    });
    return reply({ ok: true });
  }
  throw new AssociationError("Azione non valida.");
}
export async function GET(req: Request) {
  try { return await handle(req); } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
  try { return await handle(req); } catch (e) { return fail(e); }
}
function fail(e: unknown) {
  if (e instanceof AssociationError) return reply({ error: e.message }, e.status);
  return reply({ error: "Errore imprevisto. Nessuna operazione confermata." }, 500);
}
