"use client";
import {useCallback,useEffect,useState} from "react";

type Match={person_id:string;full_name:string;quality:"exact"|"similar";linked:boolean};
type Registration={user_id:string;name:string;email:string;in_book:boolean;matches:Match[]};
type PersonContact={id:string;full_name:string;email:string};
const registrationRoute="/api/associazione/libri-sociali/iscrizioni";
const contactsRoute="/api/associazione/libri-sociali/distribuzione";

export default function MembershipAccountMatches(){
 const [registrations,setRegistrations]=useState<Registration[]>([]);
 const [contacts,setContacts]=useState<PersonContact[]>([]);
 const [selected,setSelected]=useState("");
 const [email,setEmail]=useState("");
 const [accepted,setAccepted]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const api=useCallback(async(path:string,init:RequestInit={})=>{
  const token=JSON.parse(localStorage.getItem("insieme_oltre_admin_session")||"null");
  if(!token?.access_token||token.expires_at*1000<Date.now())throw Error("Sessione scaduta. Accedi nuovamente all'Area Soci.");
  const response=await fetch(path,{...init,headers:{...init.headers,Authorization:"Bearer "+token.access_token},cache:"no-store"});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||"Operazione non riuscita.");}
  return response;
 },[]);
 const refresh=useCallback(async()=>{
  const [a,c]=await Promise.all([api(registrationRoute),api(contactsRoute+"?kind=contacts")]);
  setRegistrations((await a.json()).items as Registration[]);
  setContacts((await c.json()).people as PersonContact[]);
 },[api]);
 useEffect(()=>{void refresh().catch(e=>setMessage(e instanceof Error?e.message:"Rubrica non disponibile."));},[refresh]);
 async function run(task:()=>Promise<void>){
  setBusy(true);setMessage("");
  try{await task()}catch(e){setMessage(e instanceof Error?e.message:"Operazione non riuscita.");}
  finally{setBusy(false);}
 }
 const suggestions=registrations.flatMap(a=>a.matches
   .filter(m=>!m.linked&&!contacts.some(c=>c.id===m.person_id&&!!c.email))
   .map(m=>({...m,user_id:a.user_id,account_name:a.name,account_email:a.email})));
 const linked=contacts.filter(c=>!!c.email).length;
 return <section className="soci-card">
  <h2>🔗 Soci e account del sito</h2>
  <p>La quota viene registrata sul <strong>Libro soci</strong>. Per inviare la ricevuta via email tramite Brevo serve un indirizzo verificato nella rubrica ufficiale, eventualmente recuperata dall'account dell'Area Soci. L'account da solo non crea un'iscrizione associativa.</p>
  <p><strong>{contacts.length}</strong> soci nel Libro · <strong>{linked}</strong> email collegate · <strong>{suggestions.length}</strong> abbinamenti da verificare.</p>
  {suggestions.length>0&&<>
   <h3>Possibili corrispondenze con account registrati</h3>
   <p>Le differenze nei nomi richiedono la verifica dell'identità: non vengono abbinate automaticamente.</p>
   <ul>{suggestions.map(s=>{
    const key=s.user_id+":"+s.person_id;
    return <li key={key}>
     <strong>Libro soci:</strong> {s.full_name} · <strong>Account:</strong> {s.account_name} ({s.account_email})
     {s.quality==="similar"?" · Nomi simili, non identici":" · Corrispondenza esatta"}
     {selected===key&&<>
      <label className="soci-check"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/> Ho verificato che si tratta della stessa persona e autorizzo l'associazione dell'email dell'account al socio.</label>
      <button type="button" className="primary" disabled={busy||!accepted} onClick={()=>void run(async()=>{
       await api(registrationRoute,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"link_existing",user_id:s.user_id,person_id:s.person_id,confirm_link:true,confirm_names:accepted})});
       await refresh();setSelected("");setAccepted(false);setMessage("Email collegata al socio esistente. Nessuna nuova iscrizione creata.");
      })}>Conferma abbinamento</button>
     </>}
     <button type="button" disabled={busy} onClick={()=>{setSelected(selected===key?"":key);setAccepted(false);}}>{selected===key?"Annulla":"Verifica e associa"}</button>
    </li>;
   })}</ul>
  </>}
  <h3>Rubrica ufficiale email</h3>
  <p>Puoi completare manualmente gli indirizzi mancanti anche per i soci che non hanno un account sul sito. Controlla sempre il destinatario prima di spedire una ricevuta.</p>
  <label>Socio
   <select value={selected.startsWith("contact:")?selected.slice(8):""} onChange={e=>{
    setSelected(e.target.value?"contact:"+e.target.value:"");
    setEmail(contacts.find(c=>c.id===e.target.value)?.email||"");
   }}>
    <option value="">Seleziona un socio da aggiornare</option>
    {contacts.map(c=><option key={c.id} value={c.id}>{c.full_name}{c.email?" · "+c.email:" · Email mancante"}</option>)}
   </select>
  </label>
  {selected.startsWith("contact:")&&<>
   <label>Indirizzo email verificato
    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="socio@esempio.it" required maxLength={254}/>
   </label>
   <button type="button" disabled={busy||!email.trim()} onClick={()=>void run(async()=>{
    await api(contactsRoute,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({person_id:selected.slice(8),email:email.trim()})});
    await refresh();setSelected("");setEmail("");setMessage("Rubrica aggiornata. Il nuovo destinatario sarà mostrato prima dell'invio della ricevuta.");
   })}>Salva indirizzo email</button>
  </>}
  {message&&<p role="status" className="soci-message">{message}</p>}
 </section>;
}
