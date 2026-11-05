import { createHash, randomUUID } from "node:crypto";
import { authorize, AssociationError, jsonBody, privateHeaders, service, uuid } from "../../../../../lib/associationServer";
import { socialRegisterPdf, type RegisterKind } from "../../../../../lib/socialRegisterPdf";

export const runtime = "nodejs";
const bucket = "association-signed-documents";
const allowed: RegisterKind[] = ["soci","volontari","assemblee","direttivo"];
const validKind = (x:unknown):x is RegisterKind => typeof x === "string" && allowed.includes(x as RegisterKind);
const people = (kind:RegisterKind) => kind==="soci"||kind==="volontari";
type Archive = {id:string;kind:RegisterKind;stage:"original"|"signed";source_id:string|null;object_path:string;filename:string;sha256:string;file_bytes:number;created_at:string};
const checksum=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
const reply=(payload:unknown,status=200)=>Response.json(payload,{status,headers:privateHeaders});
async function list(kind:RegisterKind):Promise<Archive[]> {
 const res=await service("/rest/v1/association_signed_documents?kind=eq."+kind+"&select=id,kind,stage,source_id,object_path,filename,sha256,file_bytes,created_at&order=created_at.desc,id.desc&limit=200");
 return (await res.json()) as Archive[];
}
async function record(id:string):Promise<Archive>{
 const [row]=await (await service("/rest/v1/association_signed_documents?id=eq."+id+"&select=id,kind,stage,source_id,object_path,filename,sha256,file_bytes,created_at")).json() as Archive[];
 if(!row)throw new AssociationError("Documento non trovato.",404);
 return row;
}
function isPdf(b:Uint8Array){
 return b.length>=16 && Buffer.from(b.subarray(0,5)).toString("ascii")==="%PDF-";
}
async function put(objectPath:string,bytes:Uint8Array){
 await service("/storage/v1/object/"+bucket+"/"+objectPath,{
  method:"POST",headers:{"Content-Type":"application/pdf","x-upsert":"false"},body:Buffer.from(bytes)
 });
}
async function insert(kind:RegisterKind,stage:"original"|"signed",path:string,filename:string,bytes:Uint8Array,actor:string,source_id:string|null){
 const r=await service("/rest/v1/association_signed_documents",{
  method:"POST",headers:{"Content-Type":"application/json",Prefer:"return=representation"},
  body:JSON.stringify({kind,stage,source_id,object_path:path,filename,sha256:checksum(bytes),file_bytes:bytes.byteLength,created_by:actor})
 });
 const [saved]=await r.json() as Archive[];
 if(!saved)throw new AssociationError("Documento non archiviato.",503);
 return saved;
}
async function store(kind:RegisterKind,stage:"original"|"signed",filename:string,bytes:Uint8Array,actor:string,source:string|null){
 const objectPath=kind+"/"+randomUUID()+".pdf";
 await put(objectPath,bytes);
 try{return await insert(kind,stage,objectPath,filename,bytes,actor,source)}
 catch(e){
  await service("/storage/v1/object/"+bucket+"/"+objectPath,{method:"DELETE"}).catch(()=>undefined);
  throw e;
 }
}
async function handle(request:Request){
 // Importante: non usare authorize(write=true): il Presidente gestisce solo questo archivio,
 // non acquisisce alcun permesso di modifica sulla contabilità generale.
 const user=await authorize(request,false,false,true);
 const params=new URL(request.url).searchParams;
 if(request.method==="GET"){
  const docId=params.get("id");
  if(docId){
   if(!uuid(docId))throw new AssociationError("Identificativo non valido.");
   const row=await record(docId);
   const file=await service("/storage/v1/object/"+bucket+"/"+row.object_path);
   const bytes=new Uint8Array(await file.arrayBuffer());
   if(bytes.length!==row.file_bytes || checksum(bytes)!==row.sha256)throw new AssociationError("Integrità archivio non verificata: download sospeso.",503);
   return new Response(bytes,{headers:{...privateHeaders,"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="'+row.filename+'"'}});
  }
  const kind=params.get("kind");
  if(!validKind(kind))throw new AssociationError("Registro non valido.");
  return reply({items:await list(kind)});
 }
 if(request.method!=="POST")throw new AssociationError("Metodo non consentito.",405);
 if(request.headers.get("content-type")?.startsWith("multipart/form-data")){
  const form=await request.formData();
  const source=form.get("source_id"),file=form.get("file");
  if(!uuid(source) || !(file instanceof File) || file.size===0 || file.size>8388608)
   throw new AssociationError("Scegli un PDF firmato fino a 8 MB.");
  if(!file.name.toLowerCase().endsWith(".pdf"))throw new AssociationError("È richiesto un PDF PAdES, non un file P7M.");
  const origin=await record(source);
  if(origin.stage!=="original")throw new AssociationError("Seleziona una versione originale.");
  const previous=await (await service("/rest/v1/association_signed_documents?source_id=eq."+origin.id+"&stage=eq.signed&select=id&limit=1")).json();
  if(previous.length)throw new AssociationError("Esiste già un PDF firmato per questa versione.",409);
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(!isPdf(bytes))throw new AssociationError("Il file non è un PDF valido.");
  // Screening strutturale: NON significa verifica crittografica PAdES, certificato o revoca.
  const raw=Buffer.from(bytes).toString("latin1");
  if(!/\/ByteRange\s*\[/.test(raw) || !/\/Contents\s*</.test(raw))
   throw new AssociationError("Non è stata rilevata una struttura di firma PDF. Esporta la firma Aruba nel formato PAdES.");
  if(checksum(bytes)===origin.sha256)throw new AssociationError("Il file coincide con l'originale non firmato.");
  const saved=await store(origin.kind,"signed","firmato-"+origin.kind+"-"+origin.id.slice(0,8)+".pdf",bytes,user.id,origin.id);
  return reply({ok:true,id:saved.id,verification:"not_verified",message:"PDF archiviato. La validità della firma deve essere verificata con Aruba Sign o un verificatore qualificato."},201);
 }
 const body=await jsonBody(request);
 if(body.action!=="prepare" || !validKind(body.kind))throw new AssociationError("Operazione non valida.");
 const kind=body.kind;
 const table=people(kind)?"association_register_people":"association_register_minutes";
 const filter=people(kind)?"register_kind":"meeting_kind";
 const order=people(kind)?"admitted_on.asc,id.asc":"meeting_on.asc,id.asc";
 const items:Record<string,unknown>[]=[];
 for(let offset=0;offset<10000;offset+=250){
  const r=await service("/rest/v1/"+table+"?"+filter+"=eq."+kind+"&select=*&order="+order+"&offset="+offset+"&limit=250");
  const part=await r.json() as Record<string,unknown>[];
  items.push(...part);
  if(part.length<250)break;
  if(offset>=9750)throw new AssociationError("Registro troppo grande per archiviazione.",413);
 }
 if(!items.length)throw new AssociationError("Il registro è vuoto: inserisci i dati prima di preparare la versione definitiva.");
 const bytes=await socialRegisterPdf(kind,items);
 if(bytes.length>8388608)throw new AssociationError("Il documento supera gli 8 MB.",413);
 const saved=await store(kind,"original","originale-"+kind+"-"+randomUUID().slice(0,8)+".pdf",bytes,user.id,null);
 return reply({ok:true,id:saved.id,sha256:saved.sha256},201);
}
async function dispatch(request:Request){
 try{return await handle(request)}
 catch(e){return reply({error:e instanceof AssociationError?e.message:"Impossibile gestire l'archivio firmato."},e instanceof AssociationError?e.status:503)}
}
export {dispatch as GET,dispatch as POST};
