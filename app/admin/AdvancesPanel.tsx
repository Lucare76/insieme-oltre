"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { categories } from "../../lib/accounting";
type Advance={id:string;kind:"deposit"|"expense";person:string;date:string;amount_cents:number;category:string;description:string};
type Payment={id:string;advance_id:string;date:string;amount_cents:number;account:"cash"|"bank"};
type Api=(path:string,init?:RequestInit)=>Promise<Response>;
const money=(n:number)=>(n/100).toLocaleString("it-IT",{style:"currency",currency:"EUR"});
const today=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome"}).format(new Date());
const date=(s:string)=>s.split("-").reverse().join("/");
const pendingKey="insieme_oltre_pending_advance_request";
export default function AdvancesPanel({api,canWrite,onAccountingChange}:{api:Api;canWrite:boolean;onAccountingChange:()=>Promise<void>}){
 const [advances,setAdvances]=useState<Advance[]>([]),[payments,setPayments]=useState<Payment[]>([]);
 const [kind,setKind]=useState("deposit"),[selected,setSelected]=useState(""),[loading,setLoading]=useState(true),[working,setWorking]=useState(false),[message,setMessage]=useState("");
 const [pending,setPending]=useState(false);
 const submitLock=useRef(false);
 const load=useCallback(async()=>{const data=await(await api("anticipazioni")).json();setAdvances(data.advances);setPayments(data.payments);return data as {advances:Advance[];payments:Payment[]}},[api]);
 useEffect(()=>{let active=true;Promise.resolve().then(()=>load()).catch(()=>{if(active)setMessage("Impossibile caricare le anticipazioni.")}).finally(()=>{if(active)setLoading(false)});queueMicrotask(()=>{if(active)setPending(!!sessionStorage.getItem(pendingKey))});return()=>{active=false}},[load]);
 const send=async(body:Record<string,unknown>)=>{
  setWorking(true);setMessage("");
  try{
   await api("anticipazioni",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   sessionStorage.removeItem(pendingKey);setPending(false);await Promise.all([load(),onAccountingChange()]);setMessage(body.action==="create"?"Anticipazione registrata.":"Rimborso registrato. Puoi scaricare la quietanza.");setSelected("");
  }catch(e){
   const status=(e as {status?:number}).status;
   if(status && status>=400 && status<500){sessionStorage.removeItem(pendingKey);setPending(false);setMessage(e instanceof Error?e.message:"Dati non validi.")}
   else {setPending(true);setMessage("Esito da verificare: usa ‘Verifica o riprova’ prima di registrare un’altra operazione.")}
  }finally{setWorking(false);submitLock.current=false}
 };
 const submit=(e:React.FormEvent<HTMLFormElement>,action:string,advance_id?:string)=>{e.preventDefault();if(working||pending||submitLock.current)return;submitLock.current=true;const data=Object.fromEntries(new FormData(e.currentTarget));const body={...data,action,id:crypto.randomUUID(),...(advance_id?{advance_id}:{})};sessionStorage.setItem(pendingKey,JSON.stringify(body));setPending(true);void send(body)};
 const retry=async()=>{const saved=sessionStorage.getItem(pendingKey);if(!saved){setPending(false);return}const body=JSON.parse(saved) as Record<string,unknown>;setWorking(true);try{const data=await load();if([...data.advances,...data.payments].some(x=>x.id===body.id)){sessionStorage.removeItem(pendingKey);setPending(false);await onAccountingChange();setMessage("Operazione già registrata: nessun duplicato creato.");setWorking(false);return}}catch{}setWorking(false);await send(body)};
 const download=async(id:string)=>{try{const blob=await(await api("anticipazioni?receipt="+id)).blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="quietanza-rimborso-"+id+".pdf";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){setMessage(e instanceof Error?e.message:"Download non riuscito.")}};
 return <section className="soci-card" aria-label="Anticipazioni e rimborsi">
  <h2>Anticipazioni e rimborsi</h2>
  <p>Registra un deposito da restituire oppure una spesa pagata personalmente per l’associazione. I rimborsi possono essere parziali.</p>
  <p><small>Il deposito e la sua restituzione movimentano i saldi ma non sono donazioni o spese di gestione. Le spese anticipate entrano tra le uscite quando vengono rimborsate. Se devi prima spostare denaro fra banca e cassa, usa il giroconto già disponibile nel registro.</small></p>
  {message&&<p role="status">{message}</p>}{pending&&canWrite&&<button type="button" disabled={working} onClick={()=>void retry()}>Verifica o riprova l’operazione</button>}
  {canWrite&&<details><summary>+ Registra anticipazione</summary><form className="soci-card" onSubmit={e=>submit(e,"create")}>
   <label>Tipo <select name="kind" value={kind} onChange={e=>setKind(e.target.value)}><option value="deposit">Deposito finanziario</option><option value="expense">Spesa anticipata</option></select></label>
   <label>Persona <input name="person" maxLength={120} required /></label>
   <label>Data <input type="date" name="date" defaultValue={today()} max={today()} required /></label>
   <label>Importo € <input name="amount" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" required /></label>
   {kind==="deposit"?<label>Deposito ricevuto su <select name="account"><option value="bank">Banca</option><option value="cash">Cassa</option></select></label>:<><input type="hidden" name="account" value="bank"/><label>Categoria della spesa <select name="category">{categories.filter(x=>!["Donazioni","Quote associative"].includes(x)).map(x=><option key={x}>{x}</option>)}</select></label><label>Iniziativa (facoltativa) <input name="project" maxLength={120}/></label></>}
   <label>Descrizione <input name="description" maxLength={500} required /></label>
   {kind==="expense"&&<p><small>Se la spesa è già stata registrata in contabilità, non inserirla nuovamente senza prima verificarla.</small></p>}
   <button type="submit" disabled={working||pending}>Registra anticipazione</button>
  </form></details>}
  {loading?<p>Caricamento…</p>:advances.length===0?<p>Nessuna anticipazione registrata.</p>:advances.map(a=>{const rows=payments.filter(p=>p.advance_id===a.id);const paid=rows.reduce((n,p)=>n+p.amount_cents,0);const remaining=a.amount_cents-paid;return <article key={a.id} className="soci-card">
   <h3>{a.person} · {a.kind==="deposit"?"Deposito finanziario":"Spesa anticipata"}</h3>
   <p>{date(a.date)} · {a.description}</p><p>Totale {money(a.amount_cents)} · Rimborsato {money(paid)} · <strong>Da rimborsare {money(remaining)}</strong></p>
   {rows.map(p=><p key={p.id}>Rimborso {date(p.date)} · {money(p.amount_cents)} · {p.account==="cash"?"Contanti":"Bonifico"} {canWrite&&<button type="button" onClick={()=>void download(p.id)}>Scarica quietanza</button>}</p>)}
   {canWrite&&remaining>0&&(selected===a.id?<form onSubmit={e=>submit(e,"reimburse",a.id)}><label>Data rimborso <input type="date" name="date" defaultValue={today()} min={a.date} max={today()} required/></label><label>Importo € <input name="amount" inputMode="decimal" defaultValue={(remaining/100).toFixed(2)} pattern="[0-9]+([.,][0-9]{1,2})?" required/></label><label>Modalità <select name="account"><option value="cash">Contanti · cassa</option><option value="bank">Bonifico · banca</option></select></label><button disabled={working||pending}>Registra rimborso</button> <button type="button" onClick={()=>setSelected("")}>Chiudi</button></form>:<button type="button" onClick={()=>setSelected(a.id)}>Registra rimborso</button>)}
  </article>})}
 </section>
}
