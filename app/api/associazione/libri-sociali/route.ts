import { authorize, AssociationError, jsonBody, privateHeaders, service, uuid } from "../../../../lib/associationServer";
import { validDate } from "../../../../lib/accounting";
import { uppercasePersonName } from "../../../../lib/personName";
import { socialRegisterPdf, type RegisterKind } from "../../../../lib/socialRegisterPdf";
export const runtime = "nodejs";
const kinds = ["soci","volontari","assemblee","direttivo"] as const;
const isKind = (x: unknown): x is RegisterKind => typeof x==="string" && kinds.some(k=>k===x);
const people = (k:RegisterKind) => k==="soci"||k==="volontari";
const reply = (obj:unknown,status=200) => Response.json(obj,{status,headers:privateHeaders});
// La data di nascita non è un movimento contabile: validDate() rifiuta gli anni
// prima del 2000. Qui accettiamo anche i soci nati nel secolo scorso.
const validBirthDate = (value: unknown): value is string => {
 if(typeof value!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const year=Number(value.slice(0,4));
 if(year<1900 || year>2199)return false;
 const date=new Date(value+"T12:00:00Z");
 if(date.toJSON()?.slice(0,10)!==value)return false;
 const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 return value<=today;
};
const cleaned = (x:unknown,max:number,required=false) => {
 if(typeof x!=="string" || x.length>max || (required && !x.trim()) || /[\u0000-\u001f]/.test(x.replace(/\n/g,""))) throw new AssociationError("Controlla i dati inseriti.");
 return x.trim();
};
async function handle(request:Request){
 // Solo Admin principale, Presidente e Tesoriere. Gli account di semplici soci non accedono ai registri.
 const actor = await authorize(request, false, false, true);
 const params = new URL(request.url).searchParams;
 const kind = params.get("kind");
 if(request.method==="GET"){
  if(!isKind(kind)) throw new AssociationError("Tipo di libro non valido.");
  const table=people(kind)?"association_register_people":"association_register_minutes";
  const filter=people(kind)?"register_kind":"meeting_kind";
  const order=people(kind)?"admitted_on.asc,id.asc":"meeting_on.asc,id.asc";
  const items:Record<string,unknown>[]=[];
  for(let offset=0;offset<10000;offset+=250){
   const res=await service(`/rest/v1/${table}?${filter}=eq.${kind}&select=*&order=${order}&offset=${offset}&limit=250`);
   const rows=await res.json() as Record<string,unknown>[];
   items.push(...rows);
   if(rows.length<250)break;
   if(offset>=9750)throw new AssociationError("Registro troppo grande per l'esportazione automatica.",413);
  }
  if(params.get("format")==="pdf"){
   const bytes=await socialRegisterPdf(kind,items);
   return new Response(new Uint8Array(bytes),{headers:{...privateHeaders,"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="insieme-oltre-${kind}.pdf"` }});
  }
  if(kind==="soci"){
   const corrections=await(await service(
    "/rest/v1/association_member_name_corrections?select=person_id,old_name,new_name,reason,changed_at&order=changed_at.desc&limit=1000"
   )).json();
   return reply({items,corrections});
  }
  return reply({items});
 }
 if(request.method==="PATCH"){
  // Non esporre la modifica generica dei registri: consenti solo l'ortografia del nominativo.
  const body=await jsonBody(request);
  if(body.kind!=="soci" || !uuid(body.person_id) || body.confirm!==true)
   throw new AssociationError("Scegli un socio e conferma la correzione.");
  const fullName=uppercasePersonName(cleaned(body.full_name,160,true));
  const expectedName=cleaned(body.expected_name,160,true);
  const reason=cleaned(body.reason,300,true);
  if(fullName.length<2 || reason.length<5 || fullName===expectedName)
   throw new AssociationError("Inserisci un nome diverso e una motivazione valida.");
  await service("/rest/v1/rpc/association_correct_member_name",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({
    p_person:body.person_id,
    p_expected_name:expectedName,
    p_new_name:fullName,
    p_reason:reason,
    p_actor:actor.id
   })
  });
  return reply({ok:true,person_id:body.person_id});
 }
 if(request.method!=="POST")throw new AssociationError("Metodo non consentito.",405);
 const body=await jsonBody(request,24000);
 if(!isKind(body.kind))throw new AssociationError("Tipo di libro non valido.");
 const table=people(body.kind)?"association_register_people":"association_register_minutes";
 let data:Record<string,unknown>;
 if(people(body.kind)){
  if(!validDate(body.admitted_on) || (body.ended_on && (!validDate(body.ended_on)||body.ended_on<body.admitted_on)) || (body.birth_date && !validBirthDate(body.birth_date)))throw new AssociationError("Controlla le date.");
  data={register_kind:body.kind,full_name:uppercasePersonName(cleaned(body.full_name,160,true)),birth_date:body.birth_date||null,fiscal_code:cleaned(body.fiscal_code??"",24),admitted_on:body.admitted_on,ended_on:body.ended_on||null,notes:cleaned(body.notes??"",500),insurance_reference:body.kind==="volontari"?cleaned(body.insurance_reference??"",160):""};
 }else{
  if(!validDate(body.meeting_on))throw new AssociationError("Data riunione non valida.");
  data={meeting_kind:body.kind,meeting_on:body.meeting_on,title:cleaned(body.title,200,true),attendees:cleaned(body.attendees,4000,true),content:cleaned(body.content,20000,true),approved:body.approved===true};
 }
 await service(`/rest/v1/${table}`,{method:"POST",headers:{"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({...data,created_by:actor.id})});
 return reply({ok:true},201);
}
async function dispatch(request:Request){
 try{return await handle(request)}catch(error){
 return reply({error:error instanceof AssociationError?error.message:"Errore imprevisto nella gestione dei libri sociali."},error instanceof AssociationError?error.status:503);
 }
}
export {dispatch as GET,dispatch as POST,dispatch as PATCH};
