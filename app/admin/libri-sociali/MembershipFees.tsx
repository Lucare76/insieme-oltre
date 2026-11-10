"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import "./quote-associative.css";
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
 const [view,setView]=useState<"overview"|"payment"|"reminder"|"cancelled">("overview");
 const [query,setQuery]=useState("");
 const [filter,setFilter]=useState<"all"|"paid"|"missing">("all");
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
 const feeByPerson=new Map((data?.fees||[]).map(f=>[f.person_id,f]));
 const peopleList=(data?.people||[]).filter(p=>{
  if(query.trim()&&!p.full_name.toLocaleLowerCase("it-IT").includes(query.trim().toLocaleLowerCase("it-IT")))return false;
  if(filter==="paid"&&!p.paid)return false;
  if(filter==="missing"&&p.paid)return false;
  return true;
 });
 const displayName=(name:string)=>name.toLocaleUpperCase("it-IT");
 const dateLabel=(value:string)=>value?.slice(0,10).split("-").reverse().join("/")||"—";
 const views=[
  {key:"overview" as const,label:"Situazione soci",hint:"Elenco e ricevute"},
  {key:"payment" as const,label:"Registra quota",hint:"Nuovo incasso"},
  {key:"reminder" as const,label:"Promemoria",hint:"Scadenze e invii"},
  {key:"cancelled" as const,label:"Quote annullate",hint:"Storico e motivazioni"},
 ];
 return <section className="soci-card fees-workspace" aria-label="Quote associative">
  <div className="fees-heading">
   <div>
    <p className="soci-kicker">GESTIONE ECONOMICA DEI SOCI</p>
    <h3>Quote associative</h3>
    <p>Una sola registrazione per quota: incasso e movimento contabile vengono creati insieme.</p>
   </div>
   <div className="fees-year">
    <label htmlFor="fees-year-select">Anno associativo
     <select id="fees-year-select" value={year} disabled={busy}
      onChange={e=>{setYear(Number(e.target.value));setData(null);setView("overview");setQuery("");setFilter("all");setMessage("");setPaymentMessage("");}}>
      {Array.from({length:6},(_,i)=>Number(todayRome().slice(0,4))+1-i).map(y=><option key={y} value={y}>{y}</option>)}
     </select>
    </label>
   </div>
  </div>
  {data ? <>
   <div className="fees-kpis" aria-label={"Riepilogo quote "+year}>
    <div className="fees-kpi"><span>Soci nel libro</span><strong>{total}</strong><small>Anagrafica del registro</small></div>
    <div className="fees-kpi"><span>Quote registrate</span><strong>{data.count}</strong><small>Anno {year}</small></div>
    <div className="fees-kpi"><span>Senza quota registrata</span><strong>{Math.max(0,total-data.count)}</strong><small>Verifica eventuali pagamenti precedenti</small></div>
    <div className="fees-kpi fees-kpi-total"><span>Incassi contabilizzati</span><strong>{eur(data.total_cents)}</strong><small>Quote associative · {year}</small></div>
   </div>
   <nav className="fees-navigation" aria-label="Strumenti quote associative">
    {views.map(v=><button key={v.key} type="button" aria-pressed={view===v.key} disabled={busy}
     onClick={()=>{setView(v.key);setSendFeeId("");setMessage("");setPaymentMessage("");}}>
     <strong>{v.label}{v.key==="cancelled"&&data.cancelled_fees?.length?" ("+data.cancelled_fees.length+")":""}</strong>
     <span>{v.hint}</span>
    </button>)}
   </nav>
   {message&&<p className="fees-notice" role="status">{message}</p>}
   {paymentMessage&&<p className="fees-notice" role="status" aria-live="polite" aria-atomic="true">{paymentMessage}</p>}
   {view==="overview"&&<div className="fees-section">
    <div className="fees-section-heading">
     <div><h4>Situazione soci · {year}</h4><p>Consulta lo stato di ogni socio e scarica le ricevute senza cambiare schermata.</p></div>
     <button type="button" disabled={busy} onClick={()=>void refresh()}>Aggiorna elenco</button>
    </div>
    <div className="fees-filters">
     <label>Cerca socio
      <input type="search" value={query} onChange={e=>setQuery(e.target.value)}
       autoComplete="off" placeholder="Nome o cognome…"/>
     </label>
     <label>Stato della quota
      <select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}>
       <option value="all">Tutti i soci</option>
       <option value="paid">Quota registrata</option>
       <option value="missing">Quota non registrata</option>
      </select>
     </label>
    </div>
    <p className="fees-results">{peopleList.length} di {total} soci</p>
    {peopleList.length===0?<div className="fees-empty">
     <strong>{total===0?"Nessun socio nel libro":"Nessun risultato per questi filtri"}</strong>
     <p>{total===0?"Inserisci prima i soci nel Libro soci.":"Prova a cambiare il nominativo o il filtro di ricerca."}</p>
    </div>:<div className="fees-table-wrap">
     <table className="fees-table">
      <thead><tr><th>Socio</th><th>Stato quota</th><th>Data / importo</th><th>Ricevuta</th></tr></thead>
      <tbody>{peopleList.map(p=>{
       const fee=feeByPerson.get(p.id);
       const ended=!!p.ended_on&&p.ended_on<todayRome();
       return <React.Fragment key={p.id}><tr>
        <td data-label="Socio"><strong>{displayName(p.full_name)}</strong>{ended&&<small>Iscrizione cessata</small>}</td>
        <td data-label="Stato"><span className={fee?"fees-status is-paid":"fees-status is-missing"}>{fee?"Registrata":"Non registrata"}</span></td>
        <td data-label="Pagamento">{fee?<><strong>{eur(fee.amount_cents)}</strong><small>{dateLabel(fee.paid_on)} · {fee.payment_account==="bank"?"Banca":"Contanti"}</small></>:<span className="fees-muted">Nessun versamento presente</span>}</td>
        <td data-label="Azioni">{fee?<div className="fees-row-actions">
         <button type="button" disabled={busy} onClick={()=>void pdf(fee.id)}>Ricevuta PDF</button>
         {fee.mail_status?<small>Email: {fee.mail_status==="sent"?"accettata da Brevo":"stato da verificare"}{fee.mail_recipient?" · "+fee.mail_recipient:""}</small>:
         fee.email?<button type="button" disabled={busy} onClick={()=>{setSendFeeId(sendFeeId===fee.id?"":fee.id);setSendConfirmed(false);}}>
          {sendFeeId===fee.id?"Chiudi invio":"Invia per email"}
         </button>:<small>Email mancante nella rubrica</small>}
        </div>:<button type="button" disabled={busy||ended} onClick={()=>{setPersonId(p.id);setView("payment");setConfirmed(false);setPaymentMessage("");}}>
         Registra quota
        </button>}</td>
        </tr>
        {sendFeeId===fee?.id&&fee.email&&!fee.mail_status&&<tr><td className="fees-confirmation-cell" colSpan={4}>
         <div className="fees-confirmation">
          <strong>Invio ricevuta a {displayName(p.full_name)}</strong>
          <p>Destinatario: <strong>{fee.email}</strong></p>
          <label className="fees-checkbox"><input type="checkbox" checked={sendConfirmed} onChange={e=>setSendConfirmed(e.target.checked)}/>
           Confermo di aver controllato il destinatario e autorizzo l'invio del PDF.
          </label>
          <div className="fees-actions">
           <button type="button" className="primary" disabled={busy||!sendConfirmed} onClick={()=>void sendEmail(fee)}>Conferma invio</button>
           <button type="button" disabled={busy} onClick={()=>{setSendFeeId("");setSendConfirmed(false);}}>Annulla</button>
          </div>
         </div>
        </td></tr>}
       </React.Fragment>;
      })}</tbody>
     </table>
    </div>}
    <p className="fees-footnote">«Non registrata» significa solo che nel gestionale non risulta una quota per questo anno. Verifica gli incassi prima di crearne una nuova.</p>
   </div>}
   {view==="payment"&&<div className="fees-section">
    <div className="fees-section-heading">
     <div><h4>Registra un versamento</h4><p>Compila soltanto i dati dell'incasso effettivamente ricevuto.</p></div>
    </div>
    <form className="fees-payment-form" noValidate onSubmit={e=>void save(e)}>
     <div className="fees-form-grid">
      <label>Socio
       <select required value={personId} onChange={e=>{setPersonId(e.target.value);setConfirmed(false);setPaymentMessage("");}}>
        <option value="">Seleziona un socio senza quota registrata</option>
        {eligible.map(p=><option value={p.id} key={p.id}>{displayName(p.full_name)}</option>)}
       </select>
      </label>
      <label>Importo incassato (€)
       <input required inputMode="decimal" placeholder="Es. 20,00" value={amount}
        onChange={e=>{setAmount(e.target.value);setPaymentMessage("");}}/>
      </label>
      <label>Data effettiva del pagamento
       <input required type="date" value={paidOn} max={todayRome()} onChange={e=>{setPaidOn(e.target.value);setPaymentMessage("");}}/>
      </label>
      <label>Modalità di incasso
       <select value={account} onChange={e=>setAccount(e.target.value as "cash"|"bank")}>
        <option value="bank">Conto bancario</option><option value="cash">Cassa contanti</option>
       </select>
      </label>
     </div>
     <label className="fees-checkbox fees-payment-confirm"><input type="checkbox" checked={confirmed}
      onChange={e=>{setConfirmed(e.target.checked);setPaymentMessage("");}}/>
      Confermo che la quota è stata realmente incassata e non è già stata registrata.
     </label>
     <div className="fees-payment-note">
      <strong>Una registrazione, un solo incasso.</strong>
      <p>Il pagamento viene salvato anche nella Contabilità. Non creare un'altra entrata per lo stesso importo.</p>
     </div>
     <div className="fees-actions">
      <button className="primary" type="submit" disabled={busy||!personId||!validMoney(amount)||!confirmed}>
       {busy?"Registrazione in corso…":"Registra quota e incasso"}
      </button>
      <button type="button" disabled={busy} onClick={()=>{setView("overview");setPaymentMessage("");}}>Torna alla situazione soci</button>
     </div>
     {eligible.length===0&&<p className="fees-muted">Non risultano soci selezionabili per una nuova quota alla data indicata.</p>}
    </form>
   </div>}
   {view==="reminder"&&<div className="fees-section">
    <div className="fees-section-heading"><div><h4>Promemoria automatici</h4>
     <p>Scadenza e invii di cortesia per i soci senza quota registrata.</p></div></div>
    <div className="fees-reminder-status">
     <span className={"fees-status "+(reminder?.setting?.enabled?"is-paid":"is-missing")}>
      {reminder?.setting?.enabled?"Promemoria configurati":"Promemoria non attivi"}
     </span>
     {reminder?.setting?.due_on&&<span className="fees-muted">Scadenza: {dateLabel(reminder.setting.due_on)}</span>}
    </div>
    <p>Il sistema prevede un'email <strong>sette giorni prima della scadenza</strong> per chi non risulta aver pagato e ha un indirizzo email disponibile.</p>
    <div className="fees-settings-form">
     <label>Data di scadenza · {year}
      <input type="date" value={dueOn} min={year+"-01-01"} max={year+"-12-31"}
       onChange={e=>{setDueOn(e.target.value);setReminderConfirm(false);}}/>
     </label>
     <label className="fees-checkbox"><input type="checkbox" checked={reminderEnabled}
      onChange={e=>{setReminderEnabled(e.target.checked);setReminderConfirm(false);}}/> Attiva i promemoria automatici</label>
     {reminderEnabled&&<label className="fees-checkbox"><input type="checkbox" checked={reminderConfirm}
      onChange={e=>setReminderConfirm(e.target.checked)}/>
      Confermo la scadenza e l'invio ai soci senza quota registrata.</label>}
     <div className="fees-actions">
      <button type="button" disabled={busy||!dueOn||(reminderEnabled&&!reminderConfirm)}
       onClick={()=>void saveReminder()}>Salva impostazioni</button>
     </div>
    </div>
    <p className="fees-footnote">Gli invii richiedono il job programmato e CRON_SECRET su Vercel. Registra gli incassi prima della scadenza per evitare promemoria non dovuti.</p>
    <h5>Storico invii ({reminder?.deliveries.length||0})</h5>
    {!reminder?.deliveries.length?<p className="fees-muted">Nessun promemoria presente per l'anno selezionato.</p>:
     <div className="fees-table-wrap"><table className="fees-table">
      <thead><tr><th>Email destinatario</th><th>Esito</th></tr></thead>
      <tbody>{reminder.deliveries.map(d=><tr key={d.person_id}>
       <td data-label="Destinatario">{d.recipient_email}</td>
       <td data-label="Esito">{d.status==="sent"?"Accettato da Brevo":d.status==="failed"?"Invio non riuscito":"Da verificare"}</td>
      </tr>)}</tbody>
     </table></div>}
   </div>}
   {view==="cancelled"&&<div className="fees-section">
    <div className="fees-section-heading"><div><h4>Storico delle quote annullate</h4>
     <p>Le quote annullate restano documentate, ma non concorrono agli incassi dell'anno.</p></div></div>
    {!data.cancelled_fees?.length?<div className="fees-empty">
     <strong>Nessuna quota annullata</strong><p>Non risultano operazioni annullate nell'anno selezionato.</p>
    </div>:<div className="fees-table-wrap"><table className="fees-table">
     <thead><tr><th>Socio</th><th>Pagamento originario</th><th>Data annullamento</th><th>Motivazione</th></tr></thead>
     <tbody>{data.cancelled_fees.map(f=><tr key={f.id}>
      <td data-label="Socio"><strong>{displayName(f.full_name)}</strong></td>
      <td data-label="Pagamento">{eur(f.amount_cents)} · {dateLabel(f.paid_on)}</td>
      <td data-label="Annullamento">{new Date(f.cancelled_at).toLocaleDateString("it-IT",{timeZone:"Europe/Rome"})}</td>
      <td data-label="Motivo">{f.cancellation_reason}</td>
     </tr>)}</tbody>
    </table></div>}
   </div>}
  </>:<div className="fees-empty" role="status">
   <strong>Caricamento quote associative…</strong><p>Recupero dati del Libro soci per l'anno {year}.</p>
  </div>}
  {!data&&message&&<p role="alert" className="fees-notice">{message}</p>}
 </section>;
}
