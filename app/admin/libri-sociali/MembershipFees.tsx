"use client";
import { uppercasePersonName } from "../../../lib/personName";
import {useCallback,useEffect,useRef,useState} from "react";
type Person={id:string;full_name:string;admitted_on:string;ended_on:string|null;paid:boolean};
type Fee={id:string;person_id:string;full_name:string;fee_year:number;amount_cents:number;paid_on:string;payment_account:"cash"|"bank";email:string;mail_status:string|null;mail_recipient:string|null};
type CancelledFee={id:string;person_id:string;full_name:string;amount_cents:number;paid_on:string;cancellation_reason:string;cancelled_at:string};
type Data={year:number;people:Person[];fees:Fee[];cancelled_fees:CancelledFee[];count:number;total_cents:number};
type Reminder={setting:{due_on:string;enabled:boolean}|null;deliveries:{person_id:string;recipient_email:string;status:string;attempted_at:string}[]};
const endpoint="/api/associazione/libri-sociali/quote";
const eur=(c:number)=>(c/100).toLocaleString("it-IT",{style:"currency",currency:"EUR"});
const todayRome=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome"}).format(new Date());
const validMoney=(value:string)=>/^\d{1,8}([.,]\d{1,2})?$/.test(value.trim()) && Number(value.replace(",","."))>0;
export default function MembershipFees(){
 const [year,setYear]=useState(Number(todayRome().slice(0,4)));
 const [data,setData]=useState<Data|null>(null);
 const [reminder,setReminder]=useState<Reminder|null>(null);
 const [dueOn,setDueOn]=useState("");
 const [reminderEnabled,setReminderEnabled]=useState(false);
 const [reminderConfirm,setReminderConfirm]=useState(false);
 const [personId,setPersonId]=useState("");
 const [amount,setAmount]=useState("");
 const [paidOn,setPaidOn]=useState(todayRome);
 const [account,setAccount]=useState<"cash"|"bank">("bank");
 const [confirmed,setConfirmed]=useState(false);
 const [sendFeeId,setSendFeeId]=useState("");
 const [sendConfirmed,setSendConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [paymentMessage,setPaymentMessage]=useState("");
 const submission=useRef(false);
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
  e.preventDefault();
  if(submission.current)return;
  setPaymentMessage("");
  const selected=data?.people.find(p=>p.id===personId);
  if(!data){setPaymentMessage("Impossibile caricare il Libro soci: aggiorna la pagina prima di registrare.");return;}
  if(!selected){setPaymentMessage("Seleziona un socio dal menu a tendina.");return;}
  if(selected.paid){setPaymentMessage("La quota di questo socio risulta già registrata per l'anno selezionato.");return;}
  if(!validMoney(amount)){setPaymentMessage("Inserisci un importo valido, per esempio 20,00 (senza simbolo €).");return;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)||!Number.isFinite(Date.parse(paidOn))){setPaymentMessage("Inserisci la data effettiva del pagamento.");return;}
  if(paidOn>todayRome()){setPaymentMessage("Non puoi registrare un pagamento con data futura.");return;}
  if(selected.admitted_on>paidOn){setPaymentMessage("La data del versamento precede l'ammissione del socio.");return;}
  if(selected.ended_on&&selected.ended_on<paidOn){setPaymentMessage("Alla data indicata il socio risulta cessato.");return;}
  if(!confirmed){setPaymentMessage("Spunta la casella per confermare che l'incasso è reale e non è già registrato.");return;}
  submission.current=true;
  setBusy(true);
  setPaymentMessage("Registrazione in corso: non ripetere l'operazione.");
  const submittedPerson=personId;
  let saved=false;
  try{
   const response=await api(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({person_id:submittedPerson,year,amount:amount.trim(),paid_on:paidOn,account,confirm:true})});
   const result=await response.json() as {ok?:boolean;id?:string};
   if(!result.ok||!result.id)throw new Error("Esito della registrazione non verificabile. Controlla le quote prima di riprovare.");
   saved=true;
   setPersonId("");setAmount("");setConfirmed(false);
   // La RPC registra quota e movimento nella stessa transazione.
   setPaymentMessage("Quota e incasso registrati correttamente. La ricevuta è disponibile nella situazione soci.");
   try{await refresh();}
   catch{setPaymentMessage("Quota e incasso salvati correttamente. Aggiorna l'elenco per scaricare la ricevuta; NON registrare nuovamente l'incasso.");}
  }catch(e){
   const error=e instanceof Error?e.message:"Errore durante la registrazione";
   if(saved){
    setPaymentMessage("Pagamento registrato, ma aggiornamento dello storico non riuscito. Aggiorna la pagina, senza ripetere la registrazione.");
   }else{
    // In caso di errore di rete, lo stato del POST può essere incerto:
    // proviamo una lettura prima di suggerire un eventuale nuovo tentativo.
    try{
     const response=await api(endpoint+"?year="+year);
     const latest=await response.json() as Data;
     setData(latest);
     const recorded=latest.fees.some(f=>f.person_id===submittedPerson);
     if(recorded){
      setPersonId("");setAmount("");setConfirmed(false);
      setPaymentMessage("La quota è presente nello storico: NON registrarla di nuovo. Puoi scaricare la ricevuta dalla situazione soci.");
     }else{
      setPaymentMessage(error+". Non risulta una quota registrata nell'elenco aggiornato: verifica la Contabilità prima di tentare nuovamente.");
     }
    }catch{
     setPaymentMessage(error+". Esito incerto: verifica lo storico quote e la Contabilità prima di premere di nuovo il pulsante.");
    }
   }
  }finally{
   submission.current=false;
   setBusy(false);
  }
 }
 async function sendEmail(fee:Fee){
  setBusy(true);setMessage("");
  try{
   await api(endpoint+"/invio",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fee_id:fee.id,confirm_email:fee.email,confirm:true})});
   await refresh();setMessage("Ricevuta accettata da Brevo per "+fee.email+". Verifica la consegna nei log.");
  }catch(e){
   await refresh().catch(()=>undefined);
   setMessage((e instanceof Error?e.message:"Invio non riuscito.")+" Prima di riprovare controlla lo storico di invio.");
  }finally{setBusy(false);setSendFeeId("");setSendConfirmed(false);}
 }
 async function pdf(id:string){
  setBusy(true);setMessage("");
  try{
   const blob=await(await api(endpoint+"?receipt="+encodeURIComponent(id))).blob();
   const url=URL.createObjectURL(blob),a=document.createElement("a");
   a.href=url;a.download="ricevuta-quota-associativa-"+year+"-"+id.slice(0,8)+".pdf";a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setMessage(e instanceof Error?e.message:"PDF non disponibile");}
  finally{setBusy(false);}
 }
 const eligible=data?.people.filter(p=>!p.paid&&(!p.ended_on||p.ended_on>=paidOn))||[];
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
   <form noValidate onSubmit={e=>void save(e)}>
    <label>Socio
     <select required value={personId} onChange={e=>{setPersonId(e.target.value);setConfirmed(false);setPaymentMessage("");}}>
      <option value="">Seleziona un socio senza quota registrata</option>
      {eligible.map(p=><option value={p.id} key={p.id}>{uppercasePersonName(p.full_name)}</option>)}
     </select>
    </label>
    <label>Importo (€)<input required inputMode="decimal" placeholder="Es. 20,00" value={amount} onChange={e=>{setAmount(e.target.value);setPaymentMessage("");}}/></label>
    <label>Data del versamento<input required type="date" value={paidOn} max={todayRome()} onChange={e=>{setPaidOn(e.target.value);setPaymentMessage("");}}/></label>
    <label>Incassato su
     <select value={account} onChange={e=>setAccount(e.target.value as "cash"|"bank")}><option value="bank">Conto bancario</option><option value="cash">Cassa contanti</option></select>
    </label>
    <label><input type="checkbox" checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);setPaymentMessage("");}}/> Confermo di aver realmente incassato la quota e che non è già stata registrata in Contabilità.</label>
    <button type="submit" className="primary" disabled={busy}>{busy?"Registrazione in corso…":"Registra quota e incasso"}</button>
    {!busy&&(!personId||!amount||!confirmed)&&<p className="soci-message" role="note">Per registrare: scegli un socio, inserisci l'importo e spunta la conferma dell'incasso. Se manca qualcosa, premi il pulsante per leggere il motivo.</p>}
    {paymentMessage&&<p className="soci-message" role="status" aria-live="polite" aria-atomic="true">{paymentMessage}</p>}
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
    return <li key={p.id}><strong>{uppercasePersonName(p.full_name)}</strong> — {fee?<>
     Pagata il {fee.paid_on.split("-").reverse().join("/")} ({eur(fee.amount_cents)})
     <button type="button" disabled={busy} onClick={()=>void pdf(fee.id)}>Scarica ricevuta PDF</button>
     {fee.mail_status
      ? <small> · Email: {fee.mail_status==="sent"?"Accettata da Brevo":"Da verificare"} ({fee.mail_recipient})</small>
      : fee.email ? <>
        <button type="button" disabled={busy} onClick={()=>{setSendFeeId(fee.id);setSendConfirmed(false);}}>Invia ricevuta via email</button>
        {sendFeeId===fee.id&&<span>
         <strong> Destinatario: {fee.email}</strong>
         <label><input type="checkbox" checked={sendConfirmed} onChange={e=>setSendConfirmed(e.target.checked)}/> Confermo il destinatario e autorizzo l'invio del PDF.</label>
         <button type="button" className="primary" disabled={busy||!sendConfirmed} onClick={()=>void sendEmail(fee)}>Conferma invio</button>
        </span>}
       </> : <small> · Email mancante nella rubrica soci</small>}
     </>:"Non registrata"}</li>;
   })}</ul>
   {!!data.cancelled_fees?.length&&<>
    <h3>Storico quote annullate · {year}</h3>
    <p><small>Le quote annullate restano documentate ma non sono conteggiate fra gli incassi. Non corrispondono a un pagamento valido nell'anno.</small></p>
    <ul>{data.cancelled_fees.map(f=><li key={f.id}>
     <strong>{uppercasePersonName(f.full_name)}</strong> — {eur(f.amount_cents)}, pagamento originario {f.paid_on.split("-").reverse().join("/")}; annullato il {new Date(f.cancelled_at).toLocaleDateString("it-IT",{timeZone:"Europe/Rome"})}.
     <strong> Motivo: </strong>{f.cancellation_reason}
    </li>)}</ul>
   </>}
   <p><small>«Non registrata» indica soltanto l'assenza di una quota in questo gestionale; verifica eventuali incassi precedenti prima di procedere. La ricevuta della quota è nominativa e non fiscale: non certifica una donazione né agevolazioni fiscali. Si genera soltanto per pagamenti registrati.</small></p>
  </>}
  {message&&<p role="status" className="soci-message">{message}</p>}
 </section>;
}
