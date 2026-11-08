import {AssociationError,privateHeaders,service} from "../../../../lib/associationServer";
import {contactMailConfig} from "../../../../lib/contactMail";
export const runtime="nodejs";
export const maxDuration=60;
type Setting={fee_year:number;due_on:string;enabled:boolean};
type Person={id:string;full_name:string;admitted_on:string;ended_on:string|null};
type Contact={person_id:string;email:string};
type Fee={person_id:string};
const reply=(x:unknown,status=200)=>Response.json(x,{status,headers:privateHeaders});
function romeDate(){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const part=(key:string)=>parts.find(p=>p.type===key)?.value||"";
 return part("year")+"-"+part("month")+"-"+part("day");
}
function datePlus(date:string,days:number){
 const [year,month,day]=date.split("-").map(Number);
 return new Date(Date.UTC(year,month-1,day+days)).toISOString().slice(0,10);
}
async function getRows<T>(url:string,limit=2000):Promise<T[]>{
 const r=await service(url+"&limit="+limit);
 return await r.json() as T[];
}
export async function GET(request:Request){
 try{
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get("authorization")!=="Bearer "+secret)
   return reply({error:"Accesso negato."},401);
  const target=datePlus(romeDate(),7);
  const settings=await getRows<Setting>("/rest/v1/association_fee_reminder_settings?due_on=eq."+target+"&enabled=eq.true&select=fee_year,due_on,enabled",5);
  if(!settings.length)return reply({ok:true,reason:"Nessuna scadenza attiva fra sette giorni.",sent:0});
  const config=contactMailConfig();
  if(!config)throw new AssociationError("Email Brevo non configurata.",503);
  let sent=0,failed=0,skipped=0;
  for(const setting of settings){
   const year=setting.fee_year;
   const [people,contacts,fees]=await Promise.all([
    getRows<Person>("/rest/v1/association_register_people?register_kind=eq.soci&select=id,full_name,admitted_on,ended_on",2000),
    getRows<Contact>("/rest/v1/association_member_delivery_contacts?select=person_id,email",2000),
    getRows<Fee>("/rest/v1/association_membership_fees?fee_year=eq."+year+"&cancelled=eq.false&select=person_id",2000)
   ]);
   const paid=new Set(fees.map(f=>f.person_id));
   const emails=new Map(contacts.map(c=>[c.person_id,c.email.trim().toLowerCase()]));
   const dueOn=setting.due_on;
   const candidates=people.filter(p=>p.admitted_on<=dueOn&&(!p.ended_on||p.ended_on>=dueOn)&&!paid.has(p.id)).slice(0,100);
   for(const p of candidates){
    const email=emails.get(p.id);
    if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){skipped++;continue;}
    // Prenotazione atomica: job concorrenti o tentativi multipli non inviano due volte.
    const reserved=await service("/rest/v1/association_fee_reminder_deliveries?on_conflict=fee_year,person_id",{
     method:"POST",headers:{"Content-Type":"application/json",Prefer:"resolution=ignore-duplicates,return=representation"},
     body:JSON.stringify({fee_year:year,person_id:p.id,recipient_email:email,status:"sending"})
    });
    const rows=await reserved.json() as {id:string}[];
    if(rows.length!==1){skipped++;continue;}
    let status:"sent"|"failed"="failed",provider_message_id:string|null=null;
    try{
     const response=await fetch("https://api.brevo.com/v3/smtp/email",{
      method:"POST",
      headers:{"Content-Type":"application/json","api-key":config.apiKey},
      body:JSON.stringify({
       sender:{name:"Insieme Oltre ODV",email:config.from},
       to:[{email,name:p.full_name}],
       subject:"Promemoria rinnovo quota associativa "+year+" — Insieme Oltre ODV",
       textContent:"Gentile "+p.full_name+",\n\nti ricordiamo che la scadenza per il rinnovo della quota associativa "+year+" è il "+dueOn.split("-").reverse().join("/")+".\n\nSe hai già provveduto al versamento, ti chiediamo di ignorare questo messaggio e di segnalarlo all'associazione per aggiornare la registrazione.\n\nPer informazioni e modalità di pagamento contatta info@insiemeoltreischia.it.\n\nInsieme Oltre ODV"
      }),signal:AbortSignal.timeout(12000),cache:"no-store"
     });
     if(!response.ok)throw Error("Provider non disponibile");
     const result=await response.json().catch(()=>({}));
     provider_message_id=typeof result.messageId==="string"?result.messageId:null;
     status="sent";sent++;
    }catch{failed++;}
    try{
     await service("/rest/v1/association_fee_reminder_deliveries?id=eq."+rows[0].id,{
      method:"PATCH",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({status,provider_message_id,completed_at:new Date().toISOString()})
     });
    }catch{ /* Lo stato sending richiede controllo manuale: non fare retry automatici. */ }
   }
  }
  return reply({ok:true,sent,failed,skipped});
 }catch(e){
  return reply({error:e instanceof AssociationError?e.message:"Promemoria non eseguito."},e instanceof AssociationError?e.status:503);
 }
}
