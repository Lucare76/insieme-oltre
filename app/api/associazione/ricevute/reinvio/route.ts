import { authorize, AssociationError, jsonBody, privateHeaders, service, uuid } from "../../../../../lib/associationServer";
import { contactMailConfig } from "../../../../../lib/contactMail";
import { receiptPdf } from "../../../../../lib/receiptPdf";
import { receiptTitle, type Receipt } from "../../../../../lib/receipts";
import { membershipFeePdf } from "../../../../../lib/membershipFeePdf";

export const runtime = "nodejs";
export const maxDuration = 30;
type Source = "general" | "membership";
type MembershipFee = {
  id:string; person_id:string; fee_year:number; amount_cents:number;
  paid_on:string; payment_account:"cash"|"bank"; created_at:string; cancelled:boolean;
};
type Person = { full_name:string; fiscal_code:string|null };
type ReceiptRecord = Receipt & {pdf_base64:string|null};
type MailState = "sent"|"failed"|"unknown";
const reply = (data:unknown,status=200) => Response.json(data,{status,headers:privateHeaders});

async function handle(req:Request) {
  if(req.method!=="POST")throw new AssociationError("Metodo non consentito.",405);
  const b=await jsonBody(req);
  const source=b.source;
  if(source!=="membership"&&source!=="general")throw new AssociationError("Tipo di ricevuta non valido.");
  // Il Presidente gestisce le quote nel Libro soci, non le ricevute di donazioni.
  const actor=source==="membership"
    ? await authorize(req,false,false,true)
    : await authorize(req,true);
  if(!uuid(b.id)||b.confirm!==true||
     typeof b.confirm_email!=="string"||
     typeof b.reason!=="string"||b.reason.trim().length<5||b.reason.length>240)
    throw new AssociationError("Conferma indirizzo e motivo del reinvio (almeno 5 caratteri).");
  const config=contactMailConfig();
  if(!config)throw new AssociationError("Invio email Brevo non configurato.",503);

  let recipient="",name="",subject="",message="",filename="",pdf:Buffer;
  const originalId=b.id;
  if(source==="membership"){
    const fees=await(await service("/rest/v1/association_membership_fees?id=eq."+originalId+
      "&cancelled=eq.false&select=id,person_id,fee_year,amount_cents,paid_on,payment_account,created_at,cancelled&limit=1")).json() as MembershipFee[];
    const fee=fees[0];
    if(!fee)throw new AssociationError("Quota annullata o inesistente: nessuna email inviata.",404);
    const [persons,contacts,deliveries]=await Promise.all([
      service("/rest/v1/association_register_people?id=eq."+fee.person_id+
        "&register_kind=eq.soci&select=full_name,fiscal_code&limit=1").then(r=>r.json()) as Promise<Person[]>,
      service("/rest/v1/association_member_delivery_contacts?person_id=eq."+fee.person_id+
        "&select=email&limit=1").then(r=>r.json()) as Promise<{email:string}[]>,
      service("/rest/v1/association_membership_receipt_deliveries?fee_id=eq."+fee.id+
        "&select=status&limit=1").then(r=>r.json()) as Promise<{status:string}[]>,
    ]);
    const person=persons[0];
    if(!person)throw new AssociationError("Socio non trovato.",404);
    if(deliveries[0]?.status!=="sent")
      throw new AssociationError("Il primo invio deve risultare accettato da Brevo. Verifica lo storico.",409);
    recipient=contacts[0]?.email?.trim().toLowerCase()||"";
    name=person.full_name;
    if(!recipient)throw new AssociationError("Indirizzo ufficiale mancante nella rubrica soci.",409);
    try { pdf=await membershipFeePdf({...fee,full_name:person.full_name,fiscal_code:person.fiscal_code}); }
    catch {throw new AssociationError("Ricevuta PDF non generabile: verifica i dati dell'associazione.",503);}
    subject="Reinvio ricevuta quota associativa "+fee.fee_year+" — Insieme Oltre ODV";
    message="Come richiesto, inviamo nuovamente la ricevuta relativa alla quota associativa "+fee.fee_year+
      ", già registrata. Non si tratta di un nuovo versamento.";
    filename="ricevuta-quota-"+fee.fee_year+"-"+fee.id.slice(0,8)+".pdf";
  }else{
    const items=await(await service("/rest/v1/association_receipts?id=eq."+originalId+
      "&cancelled=eq.false&select=*&limit=1")).json() as ReceiptRecord[];
    const original=items[0];
    if(!original)throw new AssociationError("Ricevuta annullata o inesistente.",404);
    if(original.mail_status!=="sent")
      throw new AssociationError("Il primo invio deve risultare accettato da Brevo. Verifica lo storico.",409);
    recipient=original.data.email.trim().toLowerCase();
    name=original.data.name;
    try{
      pdf=original.pdf_base64 ? Buffer.from(original.pdf_base64,"base64") : await receiptPdf(original);
    }catch{
      throw new AssociationError("Ricevuta PDF non generabile: verifica il documento.",503);
    }
    subject="Reinvio ricevuta "+original.number+"/"+original.issued_on.slice(0,4)+" — Insieme Oltre ODV";
    message="Come richiesto, alleghiamo nuovamente la "+receiptTitle(original.data.type).toLowerCase()+
      " n. "+original.number+"/"+original.issued_on.slice(0,4)+
      ". Il documento è già stato emesso e questo invio non rappresenta un nuovo incasso.";
    filename="ricevuta-"+original.number+"-"+original.issued_on.slice(0,4)+".pdf";
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)||
     b.confirm_email.trim().toLowerCase()!==recipient)
    throw new AssociationError("L'indirizzo confermato non coincide con quello ufficiale. Nessun invio eseguito.",409);
  if(pdf.length===0||pdf.length>10*1024*1024)
    throw new AssociationError("PDF non valido o troppo grande.",413);
  // Prenotazione atomica, su riga sorgente con SELECT FOR UPDATE; crea solo un tentativo tracciato.
  const reserved=await service("/rest/v1/rpc/association_reserve_receipt_resend",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      p_source:source,p_source_id:originalId,p_recipient:recipient,
      p_actor:actor.id,p_reason:b.reason.trim(),
    })
  });
  const attemptId=await reserved.json() as string;
  if(!uuid(attemptId))throw new AssociationError("Prenotazione del reinvio non verificabile. Non riprovare senza controllare lo storico.",503);

  let state:MailState="unknown";
  let providerId:string|null=null,errorMessage:string|null=null;
  try {
    const response=await fetch("https://api.brevo.com/v3/smtp/email",{
      method:"POST",cache:"no-store",signal:AbortSignal.timeout(12000),
      headers:{"Content-Type":"application/json","api-key":config.apiKey},
      body:JSON.stringify({
        sender:{name:"Insieme Oltre ODV",email:config.from},
        to:[{email:recipient,name}],
        subject,
        textContent:"Gentile "+name+",\n\n"+message+"\n\nUn caro saluto,\nInsieme Oltre ODV",
        attachment:[{name:filename,content:pdf.toString("base64")}],
      })
    });
    if(response.ok){
      const result=await response.json().catch(()=>({}));
      providerId=typeof result.messageId==="string"?result.messageId:null;
      state="sent";
    }else{
      state=response.status>=500?"unknown":"failed";
      errorMessage="Brevo HTTP "+response.status;
    }
  }catch{
    state="unknown";
    errorMessage="Esito non confermato dal servizio email";
  }
  try{
    const settled=await service("/rest/v1/association_receipt_resend_attempts?id=eq."+attemptId+"&status=eq.sending",{
      method:"PATCH",headers:{"Content-Type":"application/json",Prefer:"return=representation"},
      body:JSON.stringify({
        status:state,provider_message_id:providerId,error_message:errorMessage,
        completed_at:new Date().toISOString(),
      })
    });
    const rows=await settled.json() as {id:string}[];
    if(rows.length!==1)throw new Error("no row updated");
  }catch{
    throw new AssociationError("Reinvio tentato ma non archiviato correttamente. Verifica su Brevo prima di procedere.",503);
  }
  if(state!=="sent")throw new AssociationError(
    state==="unknown"
      ? "Esito incerto: verifica su Brevo prima di qualsiasi nuovo reinvio."
      : "Brevo ha rifiutato il reinvio. Consulta lo storico e verifica l'indirizzo.",503
  );
  return reply({ok:true,status:"sent",email:recipient,attempt_id:attemptId});
}
export async function POST(req:Request){
  try{return await handle(req);}
  catch(e){return reply({error:e instanceof AssociationError?e.message:"Reinvio non riuscito. Verifica lo storico prima di riprovare."},
    e instanceof AssociationError?e.status:503);}
}
