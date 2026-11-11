import {authorize,AssociationError,jsonBody,privateHeaders,service,uuid} from "../../../../../lib/associationServer";
import {parseCents,validDate} from "../../../../../lib/accounting";
import {membershipFeePdf} from "../../../../../lib/membershipFeePdf";
export const runtime="nodejs";
type Person={id:string;full_name:string;admitted_on:string;ended_on:string|null};
type Fee={id:string;person_id:string;fee_year:number;movement_id:string;amount_cents:number;paid_on:string;payment_account:"cash"|"bank";created_at:string};
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:privateHeaders});
async function loadPeople():Promise<Person[]>{
 const out:Person[]=[];
 for(let offset=0;offset<5000;offset+=500){
  const part=await(await service("/rest/v1/association_register_people?register_kind=eq.soci&select=id,full_name,admitted_on,ended_on&order=full_name.asc&offset="+offset+"&limit=500")).json() as Person[];
  out.push(...part);if(part.length<500)break;
 }
 return out;
}
async function loadFees(year:number):Promise<Fee[]>{
 return await(await service("/rest/v1/association_membership_fees?fee_year=eq."+year+"&cancelled=eq.false&select=id,person_id,fee_year,movement_id,amount_cents,paid_on,payment_account,created_at&order=paid_on.desc&limit=5000")).json() as Fee[];
}
async function handle(req:Request){
 // Libri sociali: Admin principale, Presidente e Tesoriere; non espone dati a semplici soci o psicologi.
 const actor=await authorize(req,false,false,true);
 const url=new URL(req.url);
 if(req.method==="GET"){
  const receiptId=url.searchParams.get("receipt");
  if(receiptId){
   if(!uuid(receiptId))throw new AssociationError("Ricevuta non valida.");
   const fees=await(await service("/rest/v1/association_membership_fees?id=eq."+receiptId+"&cancelled=eq.false&select=id,person_id,fee_year,movement_id,amount_cents,paid_on,payment_account,created_at&limit=1")).json() as Fee[];
   const fee=fees[0];if(!fee)throw new AssociationError("Versamento non trovato.",404);
   const people=await(await service("/rest/v1/association_register_people?id=eq."+fee.person_id+"&register_kind=eq.soci&select=id,full_name,fiscal_code&limit=1")).json() as {id:string;full_name:string;fiscal_code:string}[];
   const person=people[0];
   if(!person)throw new AssociationError("Socio non trovato.",404);
   let bytes:Buffer;
   try{
    bytes=await membershipFeePdf({...fee,full_name:person.full_name,fiscal_code:person.fiscal_code||null});
   }catch(e){
    if(e instanceof Error&&e.message.startsWith("Dati dell'associazione incompleti:"))
     throw new AssociationError(e.message,503);
    throw e;
   }
   return new Response(new Uint8Array(bytes),{headers:{...privateHeaders,"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="ricevuta-quota-associativa-'+fee.fee_year+'-'+fee.id.slice(0,8)+'.pdf"'}});
  }
  const year=Number(url.searchParams.get("year")||new Date().getUTCFullYear());
  if(!Number.isInteger(year)||year<2020||year>2199)throw new AssociationError("Anno non valido.");
  const [people,fees,contacts,history,cancelled,resends]=await Promise.all([
   loadPeople(),loadFees(year),
   service("/rest/v1/association_member_delivery_contacts?select=person_id,email&limit=5000").then(r=>r.json()) as Promise<{person_id:string;email:string}[]>,
   service("/rest/v1/association_membership_receipt_deliveries?select=fee_id,status,recipient_email&limit=5000").then(r=>r.json()) as Promise<{fee_id:string;status:string;recipient_email:string}[]>,
   service("/rest/v1/association_membership_fees?fee_year=eq."+year+"&cancelled=eq.true&select=id,person_id,amount_cents,paid_on,cancellation_reason,cancelled_at&order=cancelled_at.desc&limit=5000").then(r=>r.json()) as Promise<{id:string;person_id:string;amount_cents:number;paid_on:string;cancellation_reason:string;cancelled_at:string}[]>,
   service("/rest/v1/association_receipt_resend_attempts?source=eq.membership&select=source_id,status,attempted_at&order=attempted_at.desc&limit=5000")
     .then(r=>r.json()).catch(()=>[]) as Promise<{source_id:string;status:string;attempted_at:string}[]>
  ]);
  const resendCounts=new Map<string,number>();
  const resendLast=new Map<string,{status:string;attempted_at:string}>();
  for(const resend of resends){
    resendCounts.set(resend.source_id,(resendCounts.get(resend.source_id)||0)+1);
    if(!resendLast.has(resend.source_id))resendLast.set(resend.source_id,resend);
  }
  const registered=new Set(fees.map(f=>f.person_id));
  const emails=new Map(contacts.map(c=>[c.person_id,c.email]));
  const receipts=new Map(history.map(h=>[h.fee_id,h]));
  const names=new Map(people.map(p=>[p.id,p.full_name]));
  return reply({
   year,
   people:people.filter(p=>p.admitted_on.slice(0,4)<=String(year) && (!p.ended_on || p.ended_on.slice(0,4)>=String(year))).map(p=>({...p,paid:registered.has(p.id),email:emails.get(p.id)||""})),
   fees:fees.map(f=>({...f,full_name:names.get(f.person_id)||"Socio",email:emails.get(f.person_id)||"",mail_status:receipts.get(f.id)?.status||null,mail_recipient:receipts.get(f.id)?.recipient_email||null,resend_count:resendCounts.get(f.id)||0,resend_last_status:resendLast.get(f.id)?.status||null,resend_last_at:resendLast.get(f.id)?.attempted_at||null})),
   cancelled_fees:cancelled.map(f=>({...f,full_name:names.get(f.person_id)||"Socio"})),
   count:fees.length,total_cents:fees.reduce((sum,f)=>sum+f.amount_cents,0)
  });
 }
 if(req.method!=="POST")throw new AssociationError("Metodo non consentito.",405);
 const b=await jsonBody(req);
 const amount=parseCents(b.amount),year=Number(b.year);
 if(!uuid(b.person_id)||!Number.isInteger(year)||year<2020||year>2199||!amount||amount>100000000||!validDate(b.paid_on)||!["cash","bank"].includes(String(b.account))||b.confirm!==true)
  throw new AssociationError("Verifica socio, anno, importo, data, conto e conferma.");
 if(b.paid_on>new Date().toISOString().slice(0,10))throw new AssociationError("Non registrare un pagamento futuro.");
 const result=await service("/rest/v1/rpc/association_record_membership_fee",{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({p_person:b.person_id,p_year:year,p_cents:amount,p_paid_on:b.paid_on,p_account:b.account,p_actor:actor.id})
 });
 const id=await result.json();
 return reply({ok:true,id},201);
}
async function dispatch(req:Request){
 try{return await handle(req)}catch(e){return reply({error:e instanceof AssociationError?e.message:"Impossibile gestire le quote associative."},e instanceof AssociationError?e.status:503);}
}
export {dispatch as GET,dispatch as POST};
