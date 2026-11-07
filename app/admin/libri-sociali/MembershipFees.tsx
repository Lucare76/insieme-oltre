"use client";
import {useCallback,useEffect,useState} from "react";
type Person={id:string;full_name:string;admitted_on:string;ended_on:string|null;paid:boolean};
type Fee={id:string;person_id:string;full_name:string;fee_year:number;amount_cents:number;paid_on:string;payment_account:"cash"|"bank"};
type Data={year:number;people:Person[];fees:Fee[];count:number;total_cents:number};
type Reminder={setting:{due_on:string;enabled:boolean}|null;deliveries:{person_id:string;recipient_email:string;status:string;attempted_at:string}[]};
const endpoint="/api/associazione/libri-sociali/quote";
const eur=(c:number)=>(c/100).toLocaleString("it-IT",{style:"currency",currency:"EUR"});
export default function MembershipFees(){
 const [year,setYear]=useState(new Date().getFullYear());
 const [data,setData]=useState<Data|null>(null);
 const [reminder,setReminder]=useState<Reminder|null>(null);
 const [dueOn,setDueOn]=useState("");
 const [reminderEnabled,setReminderEnabled]=useState(false);
 const [reminderConfirm,setReminderConfirm]=useState(false);
 const [personId,setPersonId]=useState("");
 const [amount,setAmount]=useState("");
 const [paidOn,setPaidOn]=useState(new Date().toLocaleDateString("sv-SE"));
 const [account,setAccount]=useState<"cash"|"bank">("bank");
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const api=useCallback(async(url:string,init:RequestInit={})=>{
  const saved=JSON.parse(localStorage.getItem("insieme_oltre_admin_session")||"null");
  if(!saved?.access_token||saved.expires_at*1000<Date.now())throw Error("Accedi nuovamente dall'Area Soci.");
  const response=await fetch(url,{...init,cache:"no-store",headers:{...init.headers,Authorization:"Bearer "+saved.access_token}});
  if(!response.ok){const body=await response.json().catch(()=>({}));throw Error(body.error||"Operazione non riuscita.");}
  return response;
 },[]);
 const refresh=useCallback(async()=>{
  const [fees,reminders]=await Promise.all([api(endpoint+"?year="+year),api("/api/associazione/libri-sociali/promemoria?year="+year)]);
  const reminderData=await reminders.json() as Reminder;
  setData(await fees.json());setReminder(reminderData);setDueOn(reminderData.setting?.due_on||"");setReminderEnabled(reminderData.setting?.enabled||false);setReminderConfirm(false);
  setPersonId("");setConfirmed(false);
 },[api,year]);
 useEffect(()=>{void refresh().catch(e=>setMessage(e instanceof Error?e.message:"Errore caricamento"));},[refresh]);
 async function saveReminder(){
  setBusy(true);setMessage("");
  try{
   await api("/api/associazione/libri-sociali/promemoria",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({year,due_on:dueOn,enabled:reminderEnabled,confirm:reminderConfirm})});
   await refresh();setMessage(reminderEnabled?"Promemoria di rinnovo attivato. Verrà controllato automaticamente sette giorni prima della scadenza.":"Promemoria disattivato.");
  }catch(e){setMessage(e instanceof Error?e.message:"Impossibile salvare il promemoria.");}
  finally{setBusy(false);}
 }
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setMessage("");
  try{
   await api(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({person_id:personId,year,amount,paid_on:paidOn,account,confirm:confirmed})});
   await refresh();setAmount("");setMessage("Quota registrata in contabilità. Puoi scaricare l'attestazione PDF.");
  }catch(e){setMessage(e instanceof Error?e.message:"Operazione non riuscita");}
  finally{setBusy(false);}
 }
 async function pdf(id:string){
  setBusy(true);setMessage("");
  try{
   const blob=await(await api(endpoint+"?receipt="+encodeURIComponent(id))).blob();
   const url=URL.createObjectURL(blob),a=document.createElement("a");
   a.href=url;a.download="quota-associativa-"+year+"-"+id.slice(0,8)+".pdf";a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setMessage(e instanceof Error?e.message:"PDF non disponibile");}
  finally{setBusy(false);}
 }
 const eligible=data?.people.filter(p=>!p.paid&&!p.ended_on)||[];
 const total=data?.people.length||0;
 return <section className="soci-card">
  <h2>Quote associative annuali</h2>
  <p>Registra i versamenti effettivamente incassati. Ogni quota crea <strong>una sola entrata</strong> nella categoria «Quote associative». Non usare anche «Nuova entrata» per lo stesso pagamento.</p>
  <label>Anno associativo
   <select value={year} onChange={e=>setYear(Number(e.target.value))}>{Array.from({length:6},(_,i)=>new Date().getFullYear()+1-i).map(y=><option key={y} value={y}>{y}</option>)}</select>
  </label>
  {data&&<>
   <p><strong>{data.count}</strong> quote registrate · <strong>{eur(data.total_cents)}</strong> incassati · <strong>{total-data.count}</strong> soci senza quota registrata nell'anno selezionato</p>
   {!total&&<p>Il libro soci è vuoto. Inserisci prima i soci effettivi nella sezione «Libro soci».</p>}
   <h3>Registra un versamento</h3>
   <form onSubmit={e=>void save(e)}>
    <label>Socio
     <select required value={personId} onChange={e=>{setPersonId(e.target.value);setConfirmed(false);}}>
      <option value="">Seleziona un socio senza quota registrata</option>
      {eligible.map(p=><option value={p.id} key={p.id}>{p.full_name}</option>)}
     </select>
    </label>
    <label>Importo (€)<input required inputMode="decimal" placeholder="Es. 20,00" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
    <label>Data del versamento<input required type="date" value={paidOn} onChange={e=>setPaidOn(e.target.value)}/></label>
    <label>Incassato su
     <select value={account} onChange={e=>setAccount(e.target.value as "cash"|"bank")}><option value="bank">Conto bancario</option><option value="cash">Cassa contanti</option></select>
    </label>
    <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Confermo di aver realmente incassato la quota e che non è già stata registrata in Contabilità.</label>
    <button type="submit" className="primary" disabled={busy||!confirmed||!personId||!amount}>Registra quota e incasso</button>
   </form>
   <h3>Promemoria automatico di rinnovo</h3>
   <p>Un'email di cortesia viene inviata <strong>sette giorni prima della scadenza</strong> soltanto ai soci con quota non registrata e indirizzo email in rubrica. Nessun invio ai soci già in regola.</p>
   <label>Scadenza rinnovo quota {year}
    <input type="date" value={dueOn} min={year+"-01-01"} max={year+"-12-31"} onChange={e=>{setDueOn(e.target.value);setReminderConfirm(false);}}/>
   </label>
   <label><input type="checkbox" checked={reminderEnabled} onChange={e=>{setReminderEnabled(e.target.checked);setReminderConfirm(false);}}/> Attiva promemoria automatici</label>
   {reminderEnabled&&<label><input type="checkbox" checked={reminderConfirm} onChange={e=>setReminderConfirm(e.target.checked)}/> Confermo scadenza e invio automatico ai soci che non risultano aver rinnovato.</label>}
   <p><button type="button" disabled={busy||!dueOn||(reminderEnabled&&!reminderConfirm)} onClick={()=>void saveReminder()}>Salva impostazioni rinnovo</button></p>
   <p><small>L'invio avviene solo dopo la configurazione di CRON_SECRET su Vercel e l'attivazione del job programmato. Un eventuale pagamento già effettuato ma non registrato potrebbe causare un promemoria non dovuto: aggiorna gli incassi prima della scadenza.</small></p>
   {!!reminder?.deliveries.length&&<><h4>Storico promemoria ({reminder.deliveries.length})</h4><ul>{reminder.deliveries.map(d=><li key={d.person_id}>{d.recipient_email} · {d.status==="sent"?"Accettato da Brevo":d.status==="failed"?"Non inviato":"Da verificare"}</li>)}</ul></>}
   <h3>Situazione soci · {year}</h3>
   <ul>{data.people.map(p=>{
    const fee=data.fees.find(f=>f.person_id===p.id);
    return <li key={p.id}><strong>{p.full_name}</strong> — {fee?<>Pagata il {fee.paid_on.split("-").reverse().join("/")} ({eur(fee.amount_cents)}) <button type="button" disabled={busy} onClick={()=>void pdf(fee.id)}>Scarica PDF</button></>:"Non registrata"}</li>;
   })}</ul>
   <p><small>«Non registrata» indica soltanto l'assenza di una quota in questo gestionale; verifica eventuali incassi precedenti prima di procedere. Il PDF è un'attestazione del versamento, non una ricevuta di donazione fiscalmente agevolata.</small></p>
  </>}
  {message&&<p role="status" className="soci-message">{message}</p>}
 </section>;
}
