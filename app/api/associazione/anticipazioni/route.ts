import { authorize, AssociationError, jsonBody, privateHeaders, service, uuid } from "../../../../lib/associationServer";
import { parseCents, validDate } from "../../../../lib/accounting";
import { reimbursementPdf } from "../../../../lib/reimbursementPdf";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: privateHeaders });
const clean = (v: unknown, max: number, required = true) => {
 if(typeof v !== "string" || v.trim().length > max || (required && !v.trim()) || /[\u0000-\u001f\u007f]/.test(v)) throw new AssociationError("Compila correttamente i campi richiesti.");
 return v.trim();
};
const today = () => new Intl.DateTimeFormat("sv-SE", {timeZone:"Europe/Rome"}).format(new Date());
async function all(table: string) {
 const result: Record<string, unknown>[] = [];
 for(let offset=0;;offset+=500){
  const page = await (await service(`/rest/v1/${table}?select=*&order=created_at.desc&offset=${offset}&limit=500`)).json() as Record<string,unknown>[];
  result.push(...page); if(page.length<500) return result;
 }
}
async function handle(req: Request) {
 const url = new URL(req.url);
 const receipt = url.searchParams.get("receipt");
 const user = await authorize(req, req.method !== "GET", false, false, req.method === "GET" && !receipt);
 if(req.method === "GET" && receipt){
  if(!["owner","accountant"].includes(user.role)) throw new AssociationError("Non hai i permessi per questa operazione.",403);
  if(!uuid(receipt)) throw new AssociationError("Quietanza non valida.");
  const [payment] = await (await service(`/rest/v1/association_reimbursements?id=eq.${receipt}&select=*&limit=1`)).json();
  if(!payment) throw new AssociationError("Rimborso non trovato.",404);
  const [advance] = await (await service(`/rest/v1/association_advances?id=eq.${payment.advance_id}&select=*&limit=1`)).json();
  if(!advance) throw new AssociationError("Anticipazione non trovata.",404);
  const pdf=await reimbursementPdf(advance,payment);
  return new Response(new Uint8Array(pdf),{headers:{...privateHeaders,"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="quietanza-${receipt}.pdf"`}});
 }
 if(req.method === "GET") {
  const [advances,payments]=await Promise.all([all("association_advances"),all("association_reimbursements")]);
  return reply({advances,payments});
 }
 if(req.method !== "POST") throw new AssociationError("Metodo non consentito.",405);
 const b=await jsonBody(req); const amount=parseCents(b.amount);
 if(!uuid(b.id) || !amount || !validDate(b.date) || b.date > today() || !["cash","bank"].includes(String(b.account))) throw new AssociationError("Verifica data, importo e conto.");
 let args: Record<string, unknown>; let rpc: string;
 if(b.action === "create"){
  if(!["deposit","expense"].includes(String(b.kind))) throw new AssociationError("Scegli il tipo di anticipazione.");
  rpc="association_create_advance";
  args={p_id:b.id,p_actor:user.id,p_kind:b.kind,p_person:clean(b.person,120),p_date:b.date,p_amount:amount,p_account:b.account,p_category:b.kind==="deposit"?"Deposito da restituire":clean(b.category,100),p_project:b.kind==="deposit"?"":clean(b.project??"",120,false),p_description:clean(b.description,500)};
 } else if(b.action === "reimburse") {
  if(!uuid(b.advance_id)) throw new AssociationError("Anticipazione non valida.");
  rpc="association_reimburse_advance";
  args={p_id:b.id,p_actor:user.id,p_advance:b.advance_id,p_date:b.date,p_amount:amount,p_account:b.account};
 } else throw new AssociationError("Operazione non valida.");
 await service(`/rest/v1/rpc/${rpc}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(args)});
 return reply({id:b.id},201);
}
async function dispatch(req:Request){try{return await handle(req)}catch(e){return reply({error:e instanceof AssociationError?e.message:"Operazione non riuscita. Verifica i dati prima di riprovare."},e instanceof AssociationError?e.status:503)}}
export {dispatch as GET,dispatch as POST};
