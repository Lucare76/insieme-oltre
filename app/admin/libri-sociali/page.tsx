"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import SignedDocumentsPanel from "./SignedDocumentsPanel";
import "../../area-soci/soci.css";

type Kind = "soci"|"volontari"|"assemblee"|"direttivo";
const labels: Record<Kind,string> = {soci:"Libro soci",volontari:"Registro volontari",assemblee:"Verbali assemblee",direttivo:"Verbali direttivo"};
type Entry = {id:string;full_name?:string;title?:string;admitted_on?:string;meeting_on?:string};
const initial = {full_name:"",admitted_on:"",birth_date:"",fiscal_code:"",ended_on:"",notes:"",insurance_reference:"",meeting_on:"",title:"",attendees:"",content:"",approved:false};
export default function Page(){
 const [kind,setKind]=useState<Kind>("soci");
 const [data,setData]=useState(initial);
 const [items,setItems]=useState<Entry[]>([]);
 const [error,setError]=useState("");
 const [authorized,setAuthorized]=useState(false);
 const [busy,setBusy]=useState(false);
 const api=async (url:string,init:RequestInit={})=>{
  const saved=JSON.parse(localStorage.getItem("insieme_oltre_admin_session")||"null");
  if(!saved?.access_token || saved.expires_at*1000<Date.now()) throw new Error("Accedi nuovamente dall'area amministrativa.");
  const res=await fetch(url,{...init,cache:"no-store",headers:{...init.headers,Authorization:"Bearer "+saved.access_token}});
  if(!res.ok){const body=await res.json().catch(()=>({}));throw new Error(body.error||"Operazione non riuscita");}
  return res;
 };
 useEffect(()=>{
  let active=true;
  (async()=>{try{
   const me=await (await api("/api/associazione/me")).json();
   if(!["owner","president"].includes(me.user.role))throw new Error("Accesso riservato all'amministratore principale.");
   const list=await (await api("/api/associazione/libri-sociali?kind="+kind)).json();
   if(active){setAuthorized(true);setItems(list.items);setError("");}
  }catch(e){if(active)setError(e instanceof Error?e.message:"Accesso negato");}})();
  return()=>{active=false};
 },[kind]);
 const person=kind==="soci"||kind==="volontari";
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);
  try{
   await api("/api/associazione/libri-sociali",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...data,kind})});
   const list=await (await api("/api/associazione/libri-sociali?kind="+kind)).json();
   setItems(list.items);setData(initial);setError("Registrazione salvata.");
  }catch(e){setError(e instanceof Error?e.message:"Errore");}finally{setBusy(false);}
 }
 async function pdf(){
  setBusy(true);
  try{
   const blob=await (await api("/api/associazione/libri-sociali?kind="+kind+"&format=pdf")).blob();
   const url=URL.createObjectURL(blob);
   const a=document.createElement("a");a.href=url;a.download="insieme-oltre-"+kind+".pdf";a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setError(e instanceof Error?e.message:"PDF non disponibile");}finally{setBusy(false);}
 }
 const input=(key:keyof typeof initial,label:string,required=false,variant="text")=><label key={key}>{label}<input type={variant} required={required} value={String(data[key])} onChange={e=>setData({...data,[key]:e.target.value})}/></label>;
 return <main className="soci"><div className="soci-shell">
  <header className="soci-header"><Link href="/admin"><Image src="/insieme-oltre-logo.png" alt="Insieme Oltre" width={140} height={104}/></Link><div><h1>Libri sociali</h1><p>Insieme Oltre ODV · amministrazione</p></div></header>
  <p><Link href="/admin">Torna all'area riservata</Link></p>
  {error&&<p role="status" className="soci-message">{error}</p>}
  {authorized&&<><section className="soci-card">
   {(Object.keys(labels) as Kind[]).map(k=><button key={k} type="button" aria-pressed={kind===k} onClick={()=>{setKind(k);setData(initial);}}>{labels[k]}</button>)}
   <h2>{labels[kind]}</h2>
   <p>Registro indipendente dagli account di accesso. Solo Admin e Presidente possono visualizzarlo.</p>
   <button disabled={busy} type="button" onClick={()=>void pdf()}>Genera PDF con logo</button>
   <p><small>Il PDF non sostituisce l'approvazione dei verbali né la vidimazione del registro volontari.</small></p>
   <h3>Registrazioni: {items.length}</h3>
   <ol>{items.map(item=><li key={item.id}>{person?item.full_name:item.title} · {person?item.admitted_on:item.meeting_on}</li>)}</ol>
  </section>
  <section className="soci-card"><h2>Nuova registrazione</h2><form onSubmit={save}>
   {person?<>{input("full_name","Nome e cognome",true)}{input("admitted_on","Data ammissione",true,"date")}{input("birth_date","Data di nascita",false,"date")}{input("fiscal_code","Codice fiscale")}{input("ended_on","Data cessazione",false,"date")}{kind==="volontari"&&input("insurance_reference","Riferimento assicurativo")}{input("notes","Note")}</>
   :<>{input("meeting_on","Data riunione",true,"date")}{input("title","Oggetto",true)}
    <label>Partecipanti<textarea required value={data.attendees} onChange={e=>setData({...data,attendees:e.target.value})}/></label>
    <label>Verbale<textarea required rows={8} value={data.content} onChange={e=>setData({...data,content:e.target.value})}/></label>
    <label><input type="checkbox" checked={data.approved} onChange={e=>setData({...data,approved:e.target.checked})}/> Già approvato</label></>}
   <button className="primary" type="submit" disabled={busy}>Salva</button>
  </form></section><SignedDocumentsPanel kind={kind}/></>}
 </div></main>;
}
