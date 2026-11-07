import {createHash} from "node:crypto";
import {authorize,AssociationError,jsonBody,privateHeaders,service,uuid} from "../../../../../lib/associationServer";
import {socialRegisterPdf} from "../../../../../lib/socialRegisterPdf";
import {contactMailConfig} from "../../../../../lib/contactMail";

export const runtime="nodejs";
export const maxDuration=60;
type Person={id:string;full_name:string;admitted_on:string;ended_on:string|null;register_kind:string};
type Contact={person_id:string;email:string};
type Minute={id:string;meeting_kind:string;meeting_on:string;title:string;approved:boolean;attendees:string;content:string};
type Delivery={person_id:string;recipient_email:string;status:string;message_id:string|null;created_at:string;completed_at:string|null};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
const emailOK=(x:unknown):x is string=>typeof x==="string" && x.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
const digest=(items:{id:string;email:string}[])=>createHash("sha256").update(JSON.stringify(items.map(x=>[x.id,x.email]))).digest("hex");
async function getMinute(id:string):Promise<Minute>{
 const rows=await (await service("/rest/v1/association_register_minutes?id=eq."+id+"&select=id,meeting_kind,meeting_on,title,approved,attendees,content&limit=1")).json() as Minute[];
 if(!rows.length)throw new AssociationError("Verbale non trovato.",404);
 if(rows[0].meeting_kind!=="assemblee")throw new AssociationError("I verbali del Direttivo non sono inviabili a tutti i soci.",403);
 return rows[0];
}
async function recipients(){
 const people:Person[]=[];
 for(let offset=0;offset<3000;offset+=500){
  const part=await(await service("/rest/v1/association_register_people?register_kind=eq.soci&select=id,full_name,admitted_on,ended_on,register_kind&order=admitted_on.asc&offset="+offset+"&limit=500")).json() as Person[];
  people.push(...part);if(part.length<500)break;
 }
 const contacts:Contact[]=[];
 for(let offset=0;offset<3000;offset+=500){
  const part=await(await service("/rest/v1/association_member_delivery_contacts?select=person_id,email&offset="+offset+"&limit=500")).json() as Contact[];
  contacts.push(...part);if(part.length<500)break;
 }
 const contactById=new Map(contacts.map(c=>[c.person_id,c.email.trim().toLowerCase()]));
 const active=people.filter(p=>!p.ended_on);
 const withEmail=active.map(p=>({...p,email:contactById.get(p.id)||""}));
 const valid=withEmail.filter(p=>emailOK(p.email));
 const duplicates=new Set<string>();const seen=new Set<string>();
 for(const p of valid){if(seen.has(p.email))duplicates.add(p.email);seen.add(p.email);}
 return {eligible:withEmail,recipients:valid,duplicates:Array.from(duplicates)};
}
async function deliveries(minuteId:string):Promise<Delivery[]> {
 return await(await service("/rest/v1/association_minute_email_deliveries?minute_id=eq."+minuteId+"&select=person_id,recipient_email,status,message_id,created_at,completed_at&order=created_at.asc&limit=2000")).json() as Delivery[];
}
async function handle(req:Request){
 const actor=await authorize(req,false,false,true);
 const params=new URL(req.url).searchParams;
 if(req.method==="GET" && params.get("kind")==="contacts"){
  const data=await recipients();
  // In questa fase rubrica e invii sono gestiti soltanto da admin e Presidente.
  return reply({people:data.eligible,duplicates:data.duplicates});
 }
 if(req.method==="PUT"){
  const b=await jsonBody(req);
  if(!uuid(b.person_id)||!emailOK(b.email))throw new AssociationError("Scegli un socio e un'email valida.");
  const person=await(await service("/rest/v1/association_register_people?id=eq."+b.person_id+"&register_kind=eq.soci&select=id,ended_on&limit=1")).json() as {id:string;ended_on:string|null}[];
  if(!person.length || person[0].ended_on)throw new AssociationError("Il contatto deve appartenere a un socio attivo.");
  await service("/rest/v1/association_member_delivery_contacts?on_conflict=person_id",{
   method:"POST",headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},
   body:JSON.stringify({person_id:b.person_id,email:b.email.trim().toLowerCase(),updated_by:actor.id,updated_at:new Date().toISOString()})
  });
  return reply({ok:true});
 }
 const id=params.get("minute_id");
 if(req.method==="GET"){
  if(!uuid(id))throw new AssociationError("Seleziona un verbale.");
  const minute=await getMinute(id);
  const data=await recipients();
  const history=await deliveries(minute.id);
  return reply({minute,eligible:data.eligible,duplicates:data.duplicates,recipients:data.recipients.map(p=>({id:p.id,full_name:p.full_name,email:p.email})),fingerprint:digest(data.recipients),history,configured:!!contactMailConfig()});
 }
 if(req.method!=="POST")throw new AssociationError("Metodo non consentito.",405);
 const body=await jsonBody(req);
 if(!uuid(body.minute_id)||body.confirm!==true||typeof body.fingerprint!=="string")throw new AssociationError("Conferma esplicitamente i destinatari.");
 const minute=await getMinute(body.minute_id);
 if(!minute.approved)throw new AssociationError("È possibile distribuire soltanto verbali approvati.",409);
 const data=await recipients();
 if(data.duplicates.length)throw new AssociationError("Alcuni soci condividono la stessa email: correggi la rubrica prima dell'invio.",409);
 if(data.eligible.some(p=>!emailOK(p.email)))throw new AssociationError("Mancano email di soci attivi. Completa la rubrica o aggiorna il libro soci.",409);
 if(data.recipients.length===0)throw new AssociationError("Nessun socio con email presente.");
 if(data.recipients.length>100)throw new AssociationError("Troppi destinatari: suddividere l'invio.",413);
 if(digest(data.recipients)!==body.fingerprint)throw new AssociationError("La lista dei destinatari è cambiata. Aggiorna l'anteprima.",409);
 const config=contactMailConfig();
 if(!config)throw new AssociationError("Servizio email Brevo non configurato.",503);
 const previous=await deliveries(minute.id);
 if(previous.length)throw new AssociationError("Esiste già uno storico di invio per questo verbale. Nessun nuovo messaggio inviato.",409);
 const pdf=await socialRegisterPdf("assemblee",[minute as unknown as Record<string,unknown>]);
 if(pdf.length>10*1024*1024)throw new AssociationError("Allegato troppo grande.",413);
 const attachment=pdf.toString("base64");
 // L'inserimento in blocco, con vincolo unique, riserva tutti i destinatari prima del primo invio.
 // In caso di chiamate concorrenti, una sola può proseguire.
 const payload=data.recipients.map(p=>({minute_id:minute.id,person_id:p.id,recipient_email:p.email,requested_by:actor.id,status:"sending"}));
 let inserted:unknown;
 try{
  const response=await service("/rest/v1/association_minute_email_deliveries",{
   method:"POST",headers:{"Content-Type":"application/json",Prefer:"return=representation"},
   body:JSON.stringify(payload)
  });inserted=await response.json();
 }catch{throw new AssociationError("Invio già avviato o impossibile prenotare i destinatari.",409)}
 if(!Array.isArray(inserted)||inserted.length!==payload.length)throw new AssociationError("Impossibile inizializzare lo storico invii.",503);
 const subject="Verbale assemblea del "+minute.meeting_on+" — Insieme Oltre ODV";
 let sent=0,failed=0;
 // Parallelismo limitato per non saturare la funzione serverless.
 for(let i=0;i<data.recipients.length;i+=3){
  await Promise.all(data.recipients.slice(i,i+3).map(async recipient=>{
   let status="failed",messageId:string|null=null,error="Invio non riuscito";
   try{
    const res=await fetch("https://api.brevo.com/v3/smtp/email",{
     method:"POST",
     headers:{"api-key":config.apiKey,"Content-Type":"application/json"},
     body:JSON.stringify({
      sender:{name:"Insieme Oltre ODV",email:config.from},
      to:[{email:recipient.email,name:recipient.full_name}],
      subject,
      textContent:"Gentile socio/a,\n\nin allegato trovi il verbale approvato dell'assemblea del "+minute.meeting_on+".\n\nInsieme Oltre ODV\n\nDocumento riservato ai soci: non inoltrare a terzi.",
      attachment:[{name:"verbale-assemblea-"+minute.meeting_on+".pdf",content:attachment}]
     }),
     cache:"no-store",signal:AbortSignal.timeout(12000)
    });
    if(!res.ok)throw new Error("Brevo HTTP "+res.status);
    const result=await res.json().catch(()=>({}));
    messageId=typeof result.messageId==="string"?result.messageId:null;
    status="sent";error="";sent++;
   }catch{failed++}
   try{
    await service("/rest/v1/association_minute_email_deliveries?minute_id=eq."+minute.id+"&person_id=eq."+recipient.id,{
     method:"PATCH",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({status,message_id:messageId,error_message:error||null,completed_at:new Date().toISOString()})
    });
   }catch{ /* 'sending' rimane visibile per riconciliazione manuale, nessun retry automatico */ }
  }));
 }
 return reply({ok:true,sent,failed,message:"Invio completato. Consulta lo storico per controllare gli esiti (accettazione Brevo, non consegna finale)."});
}
async function dispatch(req:Request){
 try{return await handle(req)}catch(e){return reply({error:e instanceof AssociationError?e.message:"Errore invio verbali."},e instanceof AssociationError?e.status:503)}
}
export {dispatch as GET,dispatch as PUT,dispatch as POST};
