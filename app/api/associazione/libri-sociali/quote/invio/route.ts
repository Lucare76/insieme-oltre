import { authorize, AssociationError, jsonBody, privateHeaders, service, uuid } from "../../../../../../lib/associationServer";
import { membershipFeePdf } from "../../../../../../lib/membershipFeePdf";
import { contactMailConfig } from "../../../../../../lib/contactMail";

export const runtime = "nodejs";
export const maxDuration = 30;

type Fee = {
  id:string;person_id:string;fee_year:number;amount_cents:number;
  paid_on:string;payment_account:"bank"|"cash";created_at:string;
};
type Person = {id:string;full_name:string;fiscal_code:string|null};
type Contact = {email:string};

const reply = (value:unknown,status=200) => Response.json(value,{status,headers:privateHeaders});

async function handle(req:Request) {
  // Solo il gestore del Libro soci. Nessun invio da parte di un semplice socio.
  const actor = await authorize(req,false,false,true);
  if (req.method!=="POST") throw new AssociationError("Metodo non consentito.",405);
  const body = await jsonBody(req);
  if (!uuid(body.fee_id) || body.confirm!==true || typeof body.confirm_email!=="string")
    throw new AssociationError("Seleziona una quota pagata e conferma l'indirizzo email.");
  const feeId=body.fee_id;
  const fees=await(await service("/rest/v1/association_membership_fees?id=eq."+feeId+"&select=id,person_id,fee_year,amount_cents,paid_on,payment_account,created_at&limit=1")).json() as Fee[];
  const fee=fees[0];
  if(!fee)throw new AssociationError("Quota non registrata. Nessuna email inviata.",404);
  const [people,contacts]=await Promise.all([
    service("/rest/v1/association_register_people?id=eq."+fee.person_id+"&register_kind=eq.soci&select=id,full_name,fiscal_code&limit=1").then(r=>r.json()) as Promise<Person[]>,
    service("/rest/v1/association_member_delivery_contacts?person_id=eq."+fee.person_id+"&select=email&limit=1").then(r=>r.json()) as Promise<Contact[]>
  ]);
  const person=people[0],email=contacts[0]?.email?.trim().toLowerCase();
  if(!person)throw new AssociationError("Socio non trovato.",404);
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AssociationError("Email del socio mancante: completa la rubrica ufficiale prima di inviare.",409);
  if(body.confirm_email.trim().toLowerCase()!==email)
    throw new AssociationError("Indirizzo cambiato. Aggiorna i dati della quota e conferma nuovamente.",409);
  const config=contactMailConfig();
  if(!config)throw new AssociationError("Invio email Brevo non configurato.",503);

  let pdf:Buffer;
  try{
    pdf=await membershipFeePdf({...fee,full_name:person.full_name,fiscal_code:person.fiscal_code});
  }catch{
    throw new AssociationError("Ricevuta PDF non generabile. Verifica i dati fiscali dell'associazione.",503);
  }
  if(pdf.length>10*1024*1024)throw new AssociationError("Allegato PDF troppo grande.",413);

  // Riserva il diritto a un unico invio PRIMA di chiamare Brevo.
  // In caso di timeout, lo storico resta 'unknown' e non consentiamo retry ciechi.
  const result=await service("/rest/v1/association_membership_receipt_deliveries?on_conflict=fee_id",{
    method:"POST",
    headers:{"Content-Type":"application/json",Prefer:"resolution=ignore-duplicates,return=representation"},
    body:JSON.stringify({fee_id:fee.id,person_id:fee.person_id,recipient_email:email,status:"sending",requested_by:actor.id})
  });
  const reserved=await result.json() as {id:string}[];
  if(reserved.length!==1)
    throw new AssociationError("Per questa quota esiste già un tentativo di invio. Controlla lo stato prima di ripetere.",409);

  let state:"sent"|"failed"|"unknown"="unknown",providerMessage:string|null=null;
  let errorMessage:string|null=null;
  try{
    const response=await fetch("https://api.brevo.com/v3/smtp/email",{
      method:"POST",
      headers:{"Content-Type":"application/json","api-key":config.apiKey},
      body:JSON.stringify({
        sender:{name:"Insieme Oltre ODV",email:config.from},
        to:[{email,name:person.full_name}],
        subject:"Ricevuta quota associativa "+fee.fee_year+" — Insieme Oltre ODV",
        textContent:"Gentile "+person.full_name+",\n\nin allegato trovi la ricevuta relativa alla quota associativa "+fee.fee_year+
          ", versata il "+fee.paid_on.split("-").reverse().join("/")+".\n\n"+
          "Questa quota non costituisce una donazione fiscalmente agevolata.\n\nInsieme Oltre ODV",
        attachment:[{name:"ricevuta-quota-"+fee.fee_year+".pdf",content:pdf.toString("base64")}]
      }),
      cache:"no-store",signal:AbortSignal.timeout(12000)
    });
    if(response.ok){
      const payload=await response.json().catch(()=>({}));
      providerMessage=typeof payload.messageId==="string"?payload.messageId:null;
      state="sent";
    }else{
      state=response.status>=500?"unknown":"failed";
      errorMessage="Brevo HTTP "+response.status;
    }
  }catch{
    state="unknown";
    errorMessage="Esito del servizio email da verificare";
  }
  try {
    await service("/rest/v1/association_membership_receipt_deliveries?id=eq."+reserved[0].id,{
      method:"PATCH",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({status:state,provider_message_id:providerMessage,error_message:errorMessage,completed_at:new Date().toISOString()})
    });
  }catch {
    throw new AssociationError("Invio tentato ma non archiviato correttamente. Verifica su Brevo: non inviare nuovamente.",503);
  }
  if(state!=="sent")throw new AssociationError(
    state==="unknown"?"Esito da verificare su Brevo. Non reinviare per evitare duplicati.":"Brevo ha rifiutato il messaggio. Verifica lo storico prima di intervenire.",503
  );
  return reply({ok:true,status:"sent",email,message:"Ricevuta accettata da Brevo. La consegna finale si verifica nei log."});
}
export async function POST(request:Request){
  try{return await handle(request)}catch(e){
    return reply({error:e instanceof AssociationError?e.message:"Invio della ricevuta non riuscito."},e instanceof AssociationError?e.status:503);
  }
}
