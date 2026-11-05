"use client";
import { useCallback, useEffect, useState } from "react";
type Kind="soci"|"volontari"|"assemblee"|"direttivo";
type Archived={id:string;kind:Kind;stage:"original"|"signed";source_id:string|null;filename:string;sha256:string;created_at:string};
const endpoint="/api/associazione/libri-sociali/firme";
export default function SignedDocumentsPanel({kind}:{kind:Kind}){
 const [docs,setDocs]=useState<Archived[]>([]);
 const [source,setSource]=useState("");
 const [file,setFile]=useState<File|null>(null);
 const [loading,setLoading]=useState(false);
 const [message,setMessage]=useState("");
 const call=useCallback(async (url:string,init:RequestInit={})=>{
  const session=JSON.parse(localStorage.getItem("insieme_oltre_admin_session")||"null");
  if(!session?.access_token || session.expires_at*1000<Date.now())throw new Error("Sessione scaduta. Accedi nuovamente.");
  const res=await fetch(url,{...init,cache:"no-store",headers:{...init.headers,Authorization:"Bearer "+session.access_token}});
  if(!res.ok){const b=await res.json().catch(()=>({}));throw new Error(b.error||"Operazione non riuscita.");}
  return res;
 },[]);
 const refresh=useCallback(async()=>{const res=await call(endpoint+"?kind="+kind);setDocs((await res.json()).items);},[call,kind]);
 useEffect(()=>{let active=true;void refresh().catch(e=>{if(active)setMessage(e instanceof Error?e.message:"Archivio non disponibile.");});return()=>{active=false};},[refresh]);
 const run=async (fn:()=>Promise<void>)=>{setLoading(true);setMessage("");try{await fn()}catch(e){setMessage(e instanceof Error?e.message:"Operazione non riuscita.")}finally{setLoading(false)}};
 const saveOriginal=()=>void run(async()=>{
  const res=await call(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"prepare",kind})});
  const data=await res.json();await refresh();
  setSource(data.id);setMessage("Versione definitiva archiviata: scarica il PDF, firmalo con Aruba Sign in modalità PAdES e ricaricalo qui.");
 });
 const upload=()=>void run(async()=>{
  if(!source||!file)throw new Error("Seleziona una versione originale e il file PDF firmato.");
  const data=new FormData();data.set("source_id",source);data.set("file",file);
  const response=await call(endpoint,{method:"POST",body:data});
  const body=await response.json();await refresh();setFile(null);setSource("");
  setMessage(body.message);
 });
 const download=(id:string,filename:string)=>void run(async()=>{
  const res=await call(endpoint+"?id="+encodeURIComponent(id));const blob=await res.blob();
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 const originals=docs.filter(d=>d.stage==="original");
 const signed=docs.filter(d=>d.stage==="signed");
 return <section className="soci-card">
  <h2>✍️ Firma digitale Aruba · archivio</h2>
  <p>1. Prepara una versione definitiva del registro. 2. Scarica il PDF. 3. Firmalo sul computer con chiavetta Aruba Sign, scegliendo <strong>PAdES</strong>. 4. Carica il PDF firmato.</p>
  <p><button type="button" disabled={loading} onClick={saveOriginal}>Prepara e archivia PDF da firmare</button></p>
  <p><small>Ogni versione è conservata separatamente. Ulteriori modifiche ai registri non cambiano i PDF già archiviati.</small></p>
  <h3>Versioni originali ({originals.length})</h3>
  {!originals.length?<p>Non ci sono ancora versioni archiviate.</p>:<ul>{originals.map(d=><li key={d.id}>
   <button type="button" disabled={loading} onClick={()=>download(d.id,d.filename)}>Scarica originale</button>{" "}
   {new Date(d.created_at).toLocaleDateString("it-IT")} · {signed.some(s=>s.source_id===d.id)?"PDF firmato caricato":"Da firmare"}
   <div><small>SHA-256: {d.sha256}</small></div>
  </li>)}</ul>}
  <h3>Carica il PDF firmato</h3>
  <label>Versione originale
   <select value={source} onChange={e=>setSource(e.target.value)}>
    <option value="">Seleziona la versione</option>
    {originals.filter(d=>!signed.some(s=>s.source_id===d.id)).map(d=><option key={d.id} value={d.id}>{new Date(d.created_at).toLocaleString("it-IT")} · {d.id.slice(0,8)}</option>)}
   </select>
  </label>
  <label>Documento firmato in formato .pdf (massimo 8 MB)
   <input type="file" accept=".pdf,application/pdf" onChange={e=>setFile(e.target.files?.[0]??null)}/>
  </label>
  <p><button type="button" disabled={loading||!source||!file} onClick={upload}>Archivia documento firmato</button></p>
  <h3>Documenti firmati caricati ({signed.length})</h3>
  {!signed.length?<p>Nessun PDF firmato ancora caricato.</p>:<ul>{signed.map(d=><li key={d.id}>
   <button type="button" disabled={loading} onClick={()=>download(d.id,d.filename)}>Scarica PDF caricato</button>{" "}
   {new Date(d.created_at).toLocaleDateString("it-IT")}
   <div><strong>Firma non verificata dal sito</strong> · controllare validità del certificato e marca temporale in Aruba Sign.</div>
   <small>SHA-256: {d.sha256}</small>
  </li>)}</ul>}
  <p><small>Nota: il caricamento non dimostra di per sé autenticità, validità o titolarità della firma. Per il registro volontari elettronico vanno valutati anche vidimazione, marcatura temporale e conservazione a norma.</small></p>
  {message&&<p role="status" className="soci-message">{message}</p>}
 </section>;
}
