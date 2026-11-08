import {authorize,AssociationError,jsonBody,privateHeaders,service,uuid} from "../../../../../lib/associationServer";
import {validDate} from "../../../../../lib/accounting";
export const runtime="nodejs";
type Account={user_id:string;name:string;email:string;role:string;psychologist:boolean;active:boolean;activated_at:string|null};
type Person={id:string;full_name:string;ended_on:string|null};
type Contact={person_id:string;email:string};
const reply=(payload:unknown,status=200)=>Response.json(payload,{status,headers:privateHeaders});
const today=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome"}).format(new Date());
const norm=(s:string)=>s.trim().replace(/\s+/g," ").toLocaleLowerCase("it-IT");
const compact=(s:string)=>norm(s).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
function distanceAtMostOne(a:string,b:string){
 if(Math.abs(a.length-b.length)>1)return false;
 let i=0,j=0,diff=0;
 while(i<a.length&&j<b.length){
  if(a[i]===b[j]){i++;j++;continue;}
  if(++diff>1)return false;
  if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++;}
 }
 return diff+(a.length-i)+(b.length-j)<=1;
}
function match(a:string,b:string):"exact"|"similar"|null{
 if(norm(a)===norm(b))return "exact";
 const x=compact(a),y=compact(b);
 // La sola somiglianza NON autorizza l'abbinamento: richiede conferma esplicita nell'UI.
 if(x.length>=9&&y.length>=9&&(x===y||distanceAtMostOne(x,y)))return "similar";
 return null;
}
async function accounts():Promise<Account[]>{
 const out:Account[]=[];
 for(let offset=0;offset<3000;offset+=500){
  const res=await service("/rest/v1/association_members?active=eq.true&select=user_id,name,email,role,psychologist,active,activated_at&order=name.asc&offset="+offset+"&limit=500");
  const part=await res.json() as Account[];
  out.push(...part);if(part.length<500)break;
 }
 return out.filter(x=>["member","president","accountant"].includes(x.role));
}
async function existing(){
 const people=await(await service("/rest/v1/association_register_people?register_kind=eq.soci&select=id,full_name,ended_on&limit=3000")).json() as Person[];
 const contacts=await(await service("/rest/v1/association_member_delivery_contacts?select=person_id,email&limit=3000")).json() as Contact[];
 return {people,contacts};
}
const active=(p:Person)=>!p.ended_on||p.ended_on>=today();
async function handle(req:Request){
 const actor=await authorize(req,false,false,true);
 if(req.method==="GET"){
  const [registration,registered]=await Promise.all([accounts(),existing()]);
  const indexed=new Map(registered.contacts.map(c=>[c.email.trim().toLowerCase(),c.person_id]));
  const available=registered.people.filter(active);
  const names=new Set(available.map(p=>norm(p.full_name)));
  return reply({items:registration.map(a=>({
   user_id:a.user_id,name:a.name,email:a.email,role:a.role,psychologist:a.psychologist,activated_at:a.activated_at,
   in_book:indexed.has(a.email.trim().toLowerCase())||names.has(norm(a.name)),
   matches:available.map(p=>({person_id:p.id,full_name:p.full_name,quality:match(a.name,p.full_name),linked:registered.contacts.some(c=>c.person_id===p.id&&c.email.trim().toLowerCase()===a.email.trim().toLowerCase())})).filter(x=>x.quality)
  }))});
 }
 if(req.method!=="POST")throw new AssociationError("Metodo non consentito.",405);
 const b=await jsonBody(req);
 const registration=await accounts();
 const registered=await existing();
 if(b.action==="link_existing"){
  if(!uuid(b.user_id)||!uuid(b.person_id)||b.confirm_link!==true)
   throw new AssociationError("Scegli l'account e il socio da collegare, poi conferma l'abbinamento.");
  const account=registration.find(a=>a.user_id===b.user_id);
  const person=registered.people.find(p=>p.id===b.person_id&&active(p));
  if(!account||!person)throw new AssociationError("Account o socio effettivo non trovato.",404);
  const quality=match(account.name,person.full_name);
  if(!quality)throw new AssociationError("I nomi non sono sufficientemente simili per un abbinamento sicuro.",409);
  if(quality==="similar"&&b.confirm_names!==true)
   throw new AssociationError("I due nomi non coincidono esattamente: verifica l'identità e conferma la differenza prima di associare l'email.",409);
  const mail=account.email.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail))throw new AssociationError("L'email dell'account non è valida.",409);
  const current=registered.contacts.find(c=>c.person_id===person.id);
  if(current){
   if(current.email.toLowerCase()===mail)return reply({ok:true,person_id:person.id,already_linked:true});
   throw new AssociationError("Il socio ha già un'altra email in rubrica. Verifica prima di modificare.",409);
  }
  if(registered.contacts.some(c=>c.email.trim().toLowerCase()===mail))
   throw new AssociationError("L'email è già associata a un altro socio. Verifica prima di proseguire.",409);
  await service("/rest/v1/association_member_delivery_contacts",{
   method:"POST",headers:{"Content-Type":"application/json",Prefer:"return=minimal"},
   body:JSON.stringify({person_id:person.id,email:mail,updated_by:actor.id})
  });
  return reply({ok:true,person_id:person.id},201);
 }
 if(!uuid(b.user_id)||!validDate(b.admitted_on)||b.confirm_membership!==true)
  throw new AssociationError("Conferma l'iscrizione effettiva e la data di ammissione.");
 if(b.admitted_on>today())throw new AssociationError("La data di ammissione non può essere futura.");
 const account=registration.find(a=>a.user_id===b.user_id);
 if(!account)throw new AssociationError("Iscrizione attiva non trovata.",404);
 if(!account.name?.trim() || account.name.length>160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email||""))
  throw new AssociationError("Nome o email dell'iscrizione non valido.",409);
 const mail=account.email.trim().toLowerCase(),name=account.name.trim();
 const existingByEmail=registered.contacts.find(c=>c.email.trim().toLowerCase()===mail);
 const existingByName=registered.people.find(p=>active(p)&&match(p.full_name,name));
 if(existingByEmail||existingByName)
  throw new AssociationError("Socio già presente o nome molto simile nel Libro soci. Usa il collegamento ai nominativi esistenti, senza creare duplicati.",409);
 const response=await service("/rest/v1/association_register_people",{
  method:"POST",headers:{"Content-Type":"application/json",Prefer:"return=representation"},
  body:JSON.stringify({register_kind:"soci",full_name:name,admitted_on:b.admitted_on,created_by:actor.id})
 });
 const [person]=await response.json() as {id:string}[];
 if(!person?.id)throw new AssociationError("Impossibile registrare l'ammissione.",503);
 await service("/rest/v1/association_member_delivery_contacts",{
  method:"POST",headers:{"Content-Type":"application/json",Prefer:"return=minimal"},
  body:JSON.stringify({person_id:person.id,email:mail,updated_by:actor.id})
 });
 return reply({ok:true,person_id:person.id},201);
}
async function dispatch(req:Request){
 try{return await handle(req)}catch(e){return reply({error:e instanceof AssociationError?e.message:"Errore nel collegamento delle iscrizioni."},e instanceof AssociationError?e.status:503);}
}
export {dispatch as GET,dispatch as POST};
