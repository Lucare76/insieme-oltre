import {AssociationError,authorize,jsonBody,privateHeaders,service} from "../../../../../lib/associationServer";
import {validDate} from "../../../../../lib/accounting";
export const runtime="nodejs";
type Setting={fee_year:number;due_on:string;enabled:boolean;updated_at:string};
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:privateHeaders});
async function handle(request:Request){
 const user=await authorize(request,false,false,true);
 const params=new URL(request.url).searchParams;
 if(request.method==="GET"){
  const year=Number(params.get("year"));
  if(!Number.isInteger(year)||year<2020||year>2199)throw new AssociationError("Anno non valido.");
  const settings=await(await service("/rest/v1/association_fee_reminder_settings?fee_year=eq."+year+"&select=fee_year,due_on,enabled,updated_at&limit=1")).json() as Setting[];
  const deliveries=await(await service("/rest/v1/association_fee_reminder_deliveries?fee_year=eq."+year+"&select=person_id,recipient_email,status,attempted_at,completed_at&order=attempted_at.desc&limit=300")).json();
  return reply({setting:settings[0]||null,deliveries});
 }
 if(request.method!=="PUT")throw new AssociationError("Metodo non consentito.",405);
 const b=await jsonBody(request);
 const year=Number(b.year);
 if(!Number.isInteger(year)||year<2020||year>2199||!validDate(b.due_on)||!b.due_on.startsWith(year+"-")||typeof b.enabled!=="boolean")throw new AssociationError("Scadenza o anno non validi.");
 if(b.enabled===true&&b.confirm!==true)throw new AssociationError("Conferma esplicitamente l'attivazione dei promemoria automatici.");
 const existing=await(await service("/rest/v1/association_fee_reminder_settings?fee_year=eq."+year+"&select=enabled,due_on&limit=1")).json() as Setting[];
 if(existing[0]?.enabled && existing[0]?.due_on!==b.due_on){
  const sent=await(await service("/rest/v1/association_fee_reminder_deliveries?fee_year=eq."+year+"&select=person_id&limit=1")).json() as object[];
  if(sent.length)throw new AssociationError("Promemoria già elaborati per questo anno: non è possibile cambiare la scadenza.",409);
 }
 await service("/rest/v1/association_fee_reminder_settings?on_conflict=fee_year",{
  method:"POST",headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},
  body:JSON.stringify({fee_year:year,due_on:b.due_on,enabled:b.enabled,updated_by:user.id,updated_at:new Date().toISOString()})
 });
 return reply({ok:true});
}
async function dispatch(req:Request){
 try{return await handle(req)}catch(e){return reply({error:e instanceof AssociationError?e.message:"Errore gestione promemoria."},e instanceof AssociationError?e.status:503);}
}
export {dispatch as GET,dispatch as PUT};
