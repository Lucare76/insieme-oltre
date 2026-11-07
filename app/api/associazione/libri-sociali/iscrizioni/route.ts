import {authorize,AssociationError,jsonBody,privateHeaders,service,uuid} from "../../../../../lib/associationServer";
import {validDate} from "../../../../../lib/accounting";
export const runtime="nodejs";
type Account={user_id:string;name:string;email:string;role:string;psychologist:boolean;active:boolean};
type Person={id:string;full_name:string;ended_on:string|null};
type Contact={person_id:string;email:string};
const reply=(payload:unknown,status=200)=>Response.json(payload,{status,headers:privateHeaders});
async function accounts():Promise<Account[]>{
 const out:Account[]=[];
 for(let offset=0;offset<3000;offset+=500){
  const res=await service("/rest/v1/association_members?active=eq.true&select=user_id,name,email,role,psychologist,active&order=name.asc&offset="+offset+"&limit=500");
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
async function handle(req:Request){
 const actor=await authorize(req,false,false,true);
 if(req.method==="GET"){
  const [registration,registered]=await Promise.all([accounts(),existing()]);
  const indexed=new Map(registered.contacts.map(c=>[c.email.trim().toLowerCase(),c.person_id]));
  const now=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome"}).format(new Date());
  const norm=(v:string)=>v.trim().replace(/\s+/g," ").toLocaleLowerCase("it-IT");
  const names=new Set(registered.people.filter(p=>!p.ended_on||p.ended_on>=now).map(p=>norm(p.full_name)));
  return reply({items:registration.map(a=>({
   user_id:a.user_id,name:a.name,email:a.email,role:a.role,psychologist:a.psychologist,
   in_book:indexed.has(a.email.trim().toLowerCase()) || names.has(norm(a.name))
  }))});
 }
 if(req.method!=="POST")throw new AssociationError("Metodo non consentito.",405);
 const b=await jsonBody(req);
 if(!uuid(b.user_id)||!validDate(b.admitted_on)||b.confirm_membership!==true)
  throw new AssociationError("Conferma l'iscrizione effettiva e la data di ammissione.");
 if(b.admitted_on>new Date().toISOString().slice(0,10))
  throw new AssociationError("La data di ammissione non può essere futura.");
 const account=(await accounts()).find(a=>a.user_id===b.user_id);
 if(!account)throw new AssociationError("Iscrizione attiva non trovata.",404);
 if(!account.name?.trim() || account.name.length>160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email||""))
  throw new AssociationError("Nome o email dell'iscrizione non valido.",409);
 const registered=await existing();
 const mail=account.email.trim().toLowerCase(),name=account.name.trim();
 const existingByEmail=registered.contacts.find(c=>c.email.trim().toLowerCase()===mail);
 const now=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome"}).format(new Date());
 const norm=(v:string)=>v.trim().replace(/\s+/g," ").toLocaleLowerCase("it-IT");
 const existingByName=registered.people.find(p=>(!p.ended_on||p.ended_on>=now) && norm(p.full_name)===norm(name));
 if(existingByEmail||existingByName)throw new AssociationError("Socio già presente o omonimo nel libro soci. Controlla prima i dati.",409);
 const response=await service("/rest/v1/association_register_people",{
  method:"POST",headers:{"Content-Type":"application/json",Prefer:"return=representation"},
  body:JSON.stringify({register_kind:"soci",full_name:name,admitted_on:b.admitted_on,created_by:actor.id})
 });
 const [person]=await response.json() as {id:string}[];
 if(!person?.id)throw new AssociationError("Impossibile registrare l'ammissione.",503);
 // Se il salvataggio email fallisce, la persona rimane nel libro soci e potrà essere completata manualmente.
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
