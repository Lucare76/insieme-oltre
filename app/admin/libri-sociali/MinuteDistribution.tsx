"use client";
import { uppercasePersonName } from "../../../lib/personName";
import {useCallback,useEffect,useState} from "react";
type Person={id:string;full_name:string;email:string};
type Registration={user_id:string;name:string;email:string;role:string;psychologist:boolean;in_book:boolean};
type Delivery={person_id:string;recipient_email:string;status:string;created_at:string};
type Preview={minute:{id:string;title:string;meeting_on:string;approved:boolean};eligible:Person[];duplicates:string[];recipients:Person[];fingerprint:string;history:Delivery[];configured:boolean};
const url="/api/associazione/libri-sociali/distribuzione";
export default function MinuteDistribution({minutes}:{minutes:{id:string;title?:string;meeting_on?:string;approved?:boolean}[]}){
 const [contacts,setContacts]=useState<Person[]>([]);
 const [registrations,setRegistrations]=useState<Registration[]>([]);
 const [registration,setRegistration]=useState("");
 const [admittedOn,setAdmittedOn]=useState("");
 const [membershipConfirmed,setMembershipConfirmed]=useState(false);
 const [minute,setMinute]=useState("");
 const [preview,setPreview]=useState<Preview|null>(null);
 const [selectedPerson,setSelectedPerson]=useState("");
 const [email,setEmail]=useState("");
 const [confirm,setConfirm]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const api=useCallback(async(path:string,init:RequestInit={})=>{
  const session=JSON.parse(localStorage.getItem("insieme_oltre_admin_session")||"null");
  if(!session?.access_token||session.expires_at*1000<Date.now())throw Error("Sessione scaduta: accedi nuovamente.");
  const res=await fetch(path,{...init,cache:"no-store",headers:{...init.headers,Authorization:"Bearer "+session.access_token}});
  if(!res.ok){const data=await res.json().catch(()=>({}));throw Error(data.error||"Operazione non riuscita.");}
  return res;
 },[]);
 const loadContacts=useCallback(async()=>{
  const result=await(await api(url+"?kind=contacts")).json();setContacts(result.people);
 },[api]);
 const loadRegistrations=useCallback(async()=>{
  const result=await(await api("/api/associazione/libri-sociali/iscrizioni")).json();setRegistrations(result.items);
 },[api]);
 const loadPreview=useCallback(async(id:string)=>{
  const result=await(await api(url+"?minute_id="+encodeURIComponent(id))).json() as Preview;
  setPreview(result);setConfirm(false);
 },[api]);
 useEffect(()=>{void Promise.all([loadContacts(),loadRegistrations()]).catch(e=>setMessage(String(e)));},[loadContacts,loadRegistrations]);
 useEffect(()=>{setPreview(null);setConfirm(false);if(minute)void loadPreview(minute).catch(e=>setMessage(String(e)));},[minute,loadPreview]);
 async function run(task:()=>Promise<void>){
  setBusy(true);setMessage("");
  try{await task()}catch(e){setMessage(e instanceof Error?e.message:"Operazione non riuscita.");}
  finally{setBusy(false);}
 }
 async function importMember(){
  await run(async()=>{
   await api("/api/associazione/libri-sociali/iscrizioni",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:registration,admitted_on:admittedOn,confirm_membership:membershipConfirmed})});
   await Promise.all([loadContacts(),loadRegistrations()]);
   if(minute)await loadPreview(minute);
   setRegistration("");setAdmittedOn("");setMembershipConfirmed(false);setMessage("Socio importato nel libro soci con email dell’iscrizione.");
  });
 }
 async function saveContact(){
  await run(async()=>{
   await api(url,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({person_id:selectedPerson,email})});
   await loadContacts();if(minute)await loadPreview(minute);
   setSelectedPerson("");setEmail("");setMessage("Email del socio aggiornata.");
  });
 }
 async function send(){
  if(!preview||!confirm)return;
  await run(async()=>{
   const result=await(await api(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({minute_id:minute,fingerprint:preview.fingerprint,confirm:true})})).json();
   await loadPreview(minute);setMessage(result.message+" Accettati: "+result.sent+" · Errori: "+result.failed);
  });
 }
 const approved=minutes.filter(m=>m.approved);
 const missing=preview?.eligible.filter(p=>!p.email)||[];
 const ready=!!preview?.minute.approved&&!!preview?.configured&&!!preview?.recipients.length&&!missing.length&&!preview.duplicates.length&&!preview.history.length;
 return <section className="soci-card">
  <h2>✉️ Distribuzione verbali ai soci</h2>
  <p>Invia <strong>un singolo verbale assembleare approvato</strong> come PDF allegato, tramite email individuali. I verbali del Consiglio Direttivo non sono disponibili in questa funzione.</p>
  <p><small>Il PDF generato è una copia del verbale approvato nel gestionale: <strong>non è automaticamente firmato digitalmente</strong>. Prima dell'invio verifica contenuti e dati riservati.</small></p>
  <h3>Recupera i soci dalle iscrizioni</h3>
  <p>Le iscrizioni già attive nell'Area Soci vengono proposte qui. <strong>Un account approvato non equivale automaticamente all'ammissione nell'associazione</strong>: conferma soltanto i soci effettivi, con la data riportata negli atti associativi.</p>
  <p>{registrations.length} iscrizioni attive · {registrations.filter(r=>r.in_book).length} già presenti o da verificare nel libro soci</p>
  <label>Iscrizione
   <select value={registration} onChange={e=>{setRegistration(e.target.value);setMembershipConfirmed(false);}}>
    <option value="">Seleziona iscrizione da importare</option>
    {registrations.filter(r=>!r.in_book).map(r=><option key={r.user_id} value={r.user_id}>{uppercasePersonName(r.name)} · {r.email}{r.psychologist?" · Psicologa":""}</option>)}
   </select>
  </label>
  {registration&&<>
   <label>Data effettiva di ammissione a socio
    <input type="date" max={new Date().toISOString().slice(0,10)} value={admittedOn} onChange={e=>setAdmittedOn(e.target.value)}/>
   </label>
   <label><input type="checkbox" checked={membershipConfirmed} onChange={e=>setMembershipConfirmed(e.target.checked)}/> Confermo che questa persona è stata formalmente ammessa come socio e che la data è corretta.</label>
   <p><button type="button" disabled={busy||!admittedOn||!membershipConfirmed} onClick={()=>void importMember()}>Importa nel libro soci e recupera email</button></p>
  </>}
  <h3>Rubrica ufficiale</h3>
  <p>Gli indirizzi sono associati al libro soci, non agli account del sito. Inserisci un'email per ciascun socio attivo.</p>
  <p>{contacts.length} soci attivi · {contacts.filter(p=>!!p.email).length} con email</p>
  <label>Socio
   <select value={selectedPerson} onChange={e=>{setSelectedPerson(e.target.value);setEmail(contacts.find(p=>p.id===e.target.value)?.email||"");}}>
    <option value="">Seleziona un socio</option>
    {contacts.map(p=><option value={p.id} key={p.id}>{uppercasePersonName(p.full_name)}{p.email?" — "+p.email:" — email mancante"}</option>)}
   </select>
  </label>
  <label>Indirizzo email
   <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="socio@esempio.it"/>
  </label>
  <p><button type="button" disabled={busy||!selectedPerson||!email.trim()} onClick={()=>void saveContact()}>Salva indirizzo socio</button></p>
  <h3>Seleziona il verbale</h3>
  <label>Assemblea
   <select value={minute} onChange={e=>setMinute(e.target.value)}>
    <option value="">Seleziona un verbale approvato</option>
    {approved.map(m=><option value={m.id} key={m.id}>{m.meeting_on} · {m.title}</option>)}
   </select>
  </label>
  {preview&&<>
   <p><strong>{preview.minute.title}</strong> · {preview.minute.meeting_on}</p>
   {!preview.configured&&<p role="alert">Brevo non configurato: invio non disponibile.</p>}
   {!!missing.length&&<p role="alert">Mancano {missing.length} email: {missing.map(p=>uppercasePersonName(p.full_name)).join(", ")}.</p>}
   {!!preview.duplicates.length&&<p role="alert">Ci sono email duplicate nella rubrica: correggile prima dell'invio.</p>}
   <h3>Destinatari ({preview.recipients.length})</h3>
   <ul>{preview.recipients.map(p=><li key={p.id}>{uppercasePersonName(p.full_name)} · {p.email}</li>)}</ul>
   {preview.history.length>0?<><h3>Storico invio</h3><ul>{preview.history.map(h=><li key={h.person_id}>{h.recipient_email} · {h.status==="sent"?"Accettato da Brevo":h.status==="failed"?"Errore invio":"Stato da verificare"}</li>)}</ul><p><small>Non è previsto reinvio automatico: eventuali errori devono essere verificati per evitare duplicati.</small></p></>:<>
    <label><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/> Ho verificato i destinatari e il contenuto del verbale; autorizzo l'invio individuale del PDF.</label>
    <p><button className="primary" type="button" disabled={busy||!ready||!confirm} onClick={()=>void send()}>Invia verbale ai {preview.recipients.length} soci</button></p>
   </>}
  </>}
  {message&&<p role="status" className="soci-message">{message}</p>}
 </section>;
}
