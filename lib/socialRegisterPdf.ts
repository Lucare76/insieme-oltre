import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type RegisterKind = "soci" | "volontari" | "assemblee" | "direttivo";
type RecordItem = Record<string, unknown>;
const titles: Record<RegisterKind, string> = {
 soci: "Libro soci", volontari: "Registro volontari",
 assemblee: "Verbali assemblee", direttivo: "Verbali Consiglio Direttivo",
};
const str = (value: unknown) => String(value ?? "").trim();
const date = (value: unknown) => {
 const valueStr = str(value).slice(0,10);
 return /^\d{4}-\d{2}-\d{2}$/.test(valueStr) ? valueStr.split("-").reverse().join("/") : "—";
};
export async function socialRegisterPdf(kind: RegisterKind, items: RecordItem[]): Promise<Buffer> {
 const pdf = await PDFDocument.create();
 pdf.registerFontkit(fontkit);
 const asset = (name: string) => readFile(path.join(process.cwd(), "lib/receipt-assets", name));
 const [r,b,l] = await Promise.all([asset("DejaVuSans.ttf"),asset("DejaVuSans-Bold.ttf"),asset("logo.png")]);
 const normal = await pdf.embedFont(r,{subset:true});
 const strong = await pdf.embedFont(b,{subset:true});
 const logo = await pdf.embedPng(l);
 const dark = rgb(.14,.23,.18), faint = rgb(.4,.45,.42);
 let page: PDFPage = pdf.addPage([595.28,841.89]);
 let y = 0;
 const start = () => {
  page = pdf.addPage([595.28,841.89]);
  y = 766;
  page.drawText("INSIEME OLTRE ODV",{x:46,y:807,size:11,font:strong,color:dark});
  page.drawLine({start:{x:46,y:795},end:{x:549,y:795},thickness:1,color:rgb(.75,.83,.75)});
 };
 // La pagina iniziale è riservata all'intestazione più ampia.
 const dims = logo.scale(Math.min(118/logo.width,70/logo.height));
 page.drawImage(logo,{x:46,y:745,...dims});
 page.drawText(titles[kind],{x:180,y:784,size:19,font:strong,color:dark});
 page.drawText("Esportazione gestionale · non sostituisce vidimazione o sottoscrizione",{x:180,y:762,size:8,font:normal,color:faint});
 y=711;
 const write = (content: string, size=10, bold=false, indent=0) => {
  const f: PDFFont=bold?strong:normal;
  const text=content.replace(/[\u0000-\u001f]/g," ").trim()||"—";
  let line="";
  const draw = (val:string) => {
   if(y<75) start();
   page.drawText(val,{x:46+indent,y,size,font:f,color:dark});
   y-=size*1.5;
  };
  for (const ch of text) {
   if(f.widthOfTextAtSize(line+ch,size)>490-indent && line) { draw(line);line=ch; }
   else line+=ch;
  }
  draw(line);
 };
 write("Documento generato il "+new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",dateStyle:"long"}).format(new Date()),9);
 y-=13;
 if (!items.length) write("Nessuna registrazione presente nel periodo.",11);
 for (const [i,item] of items.entries()) {
  if(y<175) start();
  write(String(i+1)+". "+(kind==="soci"||kind==="volontari"?str(item.full_name):str(item.title)),12,true);
  if(kind==="soci"||kind==="volontari") {
   write("Data iscrizione: "+date(item.admitted_on)+" · Cessazione: "+(item.ended_on?date(item.ended_on):"non registrata"),9);
   if(item.birth_date)write("Nascita: "+date(item.birth_date),9);
   if(item.fiscal_code)write("Codice fiscale: "+str(item.fiscal_code),9);
   if(kind==="volontari")write("Riferimento assicurazione: "+(str(item.insurance_reference)||"non indicato"),9);
   if(item.notes)write("Note: "+str(item.notes),9);
  }else{
   write("Riunione: "+date(item.meeting_on)+" · "+(item.approved?"Approvato (dichiarato)":"Bozza da approvare"),9);
   write("Presenti: "+str(item.attendees),9);
   write("Verbale: "+str(item.content),10);
  }
  y-=16;
 }
 if(kind==="volontari"){
  y-=8;
  write("ATTENZIONE: stampa di consultazione/preparazione. Il registro richiede la corretta vidimazione prima dell'uso.",9,true);
 }
 const pages=pdf.getPages();
 pages.forEach((p,i)=>{
  p.drawLine({start:{x:46,y:49},end:{x:549,y:49},thickness:.7,color:rgb(.75,.83,.75)});
  p.drawText("Insieme Oltre ODV · Documento riservato",{x:46,y:34,size:8,font:normal,color:faint});
  p.drawText("Pagina "+(i+1)+" / "+pages.length,{x:480,y:34,size:8,font:normal,color:faint});
 });
 pdf.setTitle(titles[kind]+" - Insieme Oltre ODV");
 return Buffer.from(await pdf.save());
}
