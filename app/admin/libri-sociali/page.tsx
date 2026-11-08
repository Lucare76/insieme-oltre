"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import SignedDocumentsPanel from "./SignedDocumentsPanel";
import MinuteDistribution from "./MinuteDistribution";
import MembershipFees from "./MembershipFees";
import MembershipAccountMatches from "./MembershipAccountMatches";
import "../../area-soci/soci.css";

type Kind = "soci"|"volontari"|"assemblee"|"direttivo";
const labels: Record<Kind,string> = {soci:"Libro soci",volontari:"Registro volontari",assemblee:"Verbali assemblee",direttivo:"Verbali direttivo"};
type Entry = {id:string;full_name?:string;title?:string;admitted_on?:string;meeting_on?:string;approved?:boolean};
type NameCorrection = {person_id:string;old_name:string;new_name:string;reason:string;changed_at:string};
type NameEdit = {id:string;expected_name:string;full_name:string;reason:string;confirmed:boolean};
const initial = {full_name:"",admitted_on:"",birth_date:"",fiscal_code:"",ended_on:"",notes:"",insurance_reference:"",meeting_on:"",title:"",attendees:"",content:"",approved:false};
export default function Page(){
 const [kind,setKind]=useState<Kind>("soci");
 const [data,setData]=useState(initial);
 const [items,setItems]=useState<Entry[]>([]);
 const [corrections,setCorrections]=useState<NameCorrection[]>([]);
 const [nameEdit,setNameEdit]=useState<NameEdit|null>(null);
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
   if(!["owner","president","accountant"].includes(me.user.role))throw new Error("Accesso riservato a Admin, Presidente e Tesoriere.");
   const list=await (await api("/api/associazione/libri-sociali?kind="+kind)).json();
   if(active){setAuthorized(true);setItems(list.items);setCorrections(list.corrections||[]);setNameEdit(null);setError("");}
  }catch(e){if(active)setError(e instanceof Error?e.message:"Accesso negato");}})();
  return()=>{active=false};
 },[kind]);
 const person=kind==="soci"||kind==="volontari";
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);
  try{
   await api("/api/associazione/libri-sociali",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...data,kind})});
   const list=await (await api("/api/associazione/libri-sociali?kind="+kind)).json();
   setItems(list.items);setCorrections(list.corrections||[]);setData(initial);setError("Registrazione salvata.");
  }catch(e){setError(e instanceof Error?e.message:"Errore");}finally{setBusy(false);}
 }
 async function correctName(e:React.FormEvent){
  e.preventDefault();
  if(!nameEdit||busy)return;
  setBusy(true);setError("");
  try{
   await api("/api/associazione/libri-sociali",{
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
     kind:"soci",person_id:nameEdit.id,expected_name:nameEdit.expected_name,
     full_name:nameEdit.full_name,reason:nameEdit.reason,confirm:nameEdit.confirmed
    })
   });
   const list=await(await api("/api/associazione/libri-sociali?kind=soci")).json();
   setItems(list.items);setCorrections(list.corrections||[]);setNameEdit(null);
   setError("Nome del socio corretto. Quote, ricevute e collegamenti email rimangono associati alla stessa persona.");
  }catch(err){setError(err instanceof Error?err.message:"Correzione non riuscita.");}
  finally{setBusy(false);}
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
   {(Object.keys(labels) as Kind[]).map(k=><button key={k} type="button" aria-pressed={kind===k} onClick={()=>{setKind(k);setData(initial);setNameEdit(null);}}>{labels[k]}</button>)}
   <h2>{labels[kind]}</h2>
   <p>Registro indipendente dagli account di accesso. Accessibile soltanto a Admin principale, Presidente e Tesoriere.</p>
   <button disabled={busy} type="button" onClick={()=>void pdf()}>Genera PDF con logo</button>
   <p><small>Il PDF non sostituisce l'approvazione dei verbali né la vidimazione del registro volontari.</small></p>
   <h3>Registrazioni: {items.length}</h3>
   <ol>{items.map(item=><li key={item.id}>
    {person?item.full_name:item.title} · {person?item.admitted_on:item.meeting_on}
    {kind==="soci"&&item.full_name&&<>
     {" "}<button type="button" disabled={busy} onClick={()=>{
      setNameEdit({id:item.id,expected_name:item.full_name||"",full_name:item.full_name||"",reason:"Correzione errore di digitazione",confirmed:false});
      setError("");
     }}>Correggi nome</button>
     {nameEdit?.id===item.id&&<form className="receipt-form" onSubmit={e=>void correctName(e)}>
      <h4>Correggi nominativo del socio</h4>
      <p>Nome attuale: <strong>{nameEdit.expected_name}</strong>. La correzione non modifica la data di ammissione, il codice fiscale, le quote o l'identificativo del socio.</p>
      <label>Nome e cognome corretti
       <input required maxLength={160} aria-label="Nome corretto del socio" value={nameEdit.full_name}
        onChange={e=>setNameEdit({...nameEdit,full_name:e.target.value,confirmed:false})}/>
      </label>
      <label>Motivo della correzione
       <input required minLength={5} maxLength={300} value={nameEdit.reason}
        onChange={e=>setNameEdit({...nameEdit,reason:e.target.value,confirmed:false})}/>
      </label>
      <label className="soci-check"><input type="checkbox" checked={nameEdit.confirmed}
       onChange={e=>setNameEdit({...nameEdit,confirmed:e.target.checked})}/>
       Confermo che sto correggendo il nome della stessa persona, non sostituendo un socio con un altro.
      </label>
      <p><small>La modifica sarà registrata nello storico. Eventuali ricevute PDF già inviate non vengono richiamate o modificate retroattivamente.</small></p>
      <button type="submit" className="primary" disabled={busy||!nameEdit.confirmed||nameEdit.full_name.trim().length<2||nameEdit.full_name.trim()===nameEdit.expected_name||nameEdit.reason.trim().length<5}>Salva correzione</button>
      {" "}<button type="button" disabled={busy} onClick={()=>setNameEdit(null)}>Annulla</button>
     </form>}
    </>}
   </li>)}</ol>
   {kind==="soci"&&corrections.length>0&&<details>
    <summary>Storico correzioni nominativi ({corrections.length})</summary>
    <ul>{corrections.map((c,i)=><li key={c.person_id+":"+c.changed_at+":"+i}>
     {new Date(c.changed_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})} · <strong>{c.old_name}</strong> → <strong>{c.new_name}</strong> · {c.reason}
    </li>)}</ul>
   </details>}
  </section>
  <section className="soci-card"><h2>Nuova registrazione</h2><form onSubmit={save}>
   {person?<>{input("full_name","Nome e cognome",true)}{input("admitted_on","Data ammissione",true,"date")}{input("birth_date","Data di nascita",false,"date")}{input("fiscal_code","Codice fiscale")}{input("ended_on","Data cessazione",false,"date")}{kind==="volontari"&&input("insurance_reference","Riferimento assicurativo")}{input("notes","Note")}</>
   :<>{input("meeting_on","Data riunione",true,"date")}{input("title","Oggetto",true)}
    <label>Partecipanti<textarea required value={data.attendees} onChange={e=>setData({...data,attendees:e.target.value})}/></label>
    <label>Verbale<textarea required rows={8} value={data.content} onChange={e=>setData({...data,content:e.target.value})}/></label>
    <label><input type="checkbox" checked={data.approved} onChange={e=>setData({...data,approved:e.target.checked})}/> Già approvato</label></>}
   <button className="primary" type="submit" disabled={busy}>Salva</button>
  </form></section>{kind==="soci"&&<><MembershipAccountMatches/><MembershipFees/></>}<SignedDocumentsPanel kind={kind}/>{kind==="assemblee"&&<MinuteDistribution minutes={items}/>}</>}
 </div></main>;
}
