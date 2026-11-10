"use client";
import { useCallback, useEffect, useState } from "react";
type Product = "panettone" | "candela";
type Stock = { project: string; product: Product; total_units: number; min_price_cents: number };
type Sale = { id: string; product: Product; quantity: number; amount_cents: number; volunteer: string; sale_date: string; account: "cash" | "bank"; cancelled_at: string | null; created_at: string };
const name: Record<Product, string> = { panettone: "Panettoni", candela: "Candele" };
const price: Record<Product, number> = { panettone: 20, candela: 5 };
const money = (c: number) => (c / 100).toLocaleString("it-IT",{ style:"currency",currency:"EUR" });
const now = () => new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome"}).format(new Date());

export function FundraisingOperations({ project, api, canWrite, onAccountingChange }: {
 project: string;
 api: (path:string, init?: RequestInit) => Promise<Response>;
 canWrite: boolean;
 onAccountingChange: () => Promise<void>;
}) {
 const [stock, setStock] = useState<Stock[]>([]);
 const [sales, setSales] = useState<Sale[]>([]);
 const [loaded,setLoaded] = useState(false);
 const [busy,setBusy] = useState(false);
 const [message,setMessage] = useState("");
 const [product,setProduct] = useState<Product>("panettone");
 const [quantity,setQuantity] = useState(1);
 const [amount,setAmount] = useState("20");
 const [volunteer,setVolunteer] = useState("");
 const [account,setAccount] = useState<"cash"|"bank">("cash");
 const [date,setDate] = useState(now);
 const [stockProduct,setStockProduct] = useState<Product>("panettone");
 const [units,setUnits] = useState("0");
 const refresh = useCallback(async () => {
  const r = await api("fundraising?project="+encodeURIComponent(project));
  const data = await r.json() as {stock:Stock[],sales:Sale[]};
  setStock(data.stock); setSales(data.sales); setLoaded(true);
 },[project,api]);
 useEffect(()=>{ let active=true; queueMicrotask(()=>{setLoaded(false); setMessage("");});
  void refresh().catch(e=>{if(active)setMessage(e instanceof Error?e.message:"Impossibile caricare le consegne.");});
  return ()=>{active=false;};
 },[refresh]);
 const sold = (p:Product) => sales.filter(s=>s.product===p && !s.cancelled_at).reduce((n,s)=>n+s.quantity,0);
 const total = (p:Product) => stock.find(s=>s.product===p)?.total_units ?? 0;
 const available = (p:Product) => total(p)-sold(p);
 const doAction = async (payload:Record<string,unknown>, success:string) => {
  if(busy)return;
  setBusy(true);setMessage("");
  try{
   await api("fundraising",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({project,...payload})});
   await refresh();
   await onAccountingChange();
   setMessage(success);
  }catch(e){setMessage(e instanceof Error?e.message:"Operazione non riuscita; aggiorna prima di riprovare.");}
  finally{setBusy(false);}
 };
 const chooseProduct = (p:Product) => {setProduct(p);setAmount(String(quantity*price[p]));};
 const changeQty = (q:number) => {setQuantity(q);setAmount(String(q*price[product]));};
 const minimum = quantity*price[product];
 const actual = Number(amount.replace(",","."));
 return <section className="soci-card" aria-label="Gestione consegne solidali">
  <h3>Gestione prodotti e consegne</h3>
  <p>Registra qui una consegna: l'incasso entra automaticamente nella Contabilità e nel rendiconto. Non registrarlo una seconda volta.</p>
  {!loaded ? <div role="status">
   <p>{message ? "Impossibile caricare le giacenze." : "Caricamento giacenze…"}</p>
   {message && <button type="button" disabled={busy} onClick={() => {
    setMessage("");
    void refresh().catch(e => setMessage(e instanceof Error ? e.message : "Impossibile caricare le consegne."));
   }}>Riprova caricamento</button>}
  </div> : <>
   <div className="accounting-period">
    {(["panettone","candela"] as Product[]).map(p=><div key={p}>
     <span>{name[p]} disponibili</span>
     <strong>{available(p)} / {total(p)}</strong>
     <small>Consegnati: {sold(p)}</small>
    </div>)}
   </div>
   {canWrite && <>
    <h4>Registra una consegna</h4>
    <form onSubmit={e=>{e.preventDefault();if(!Number.isInteger(quantity)||quantity<1||quantity>available(product)||!Number.isFinite(actual)||actual<minimum)return;
     void doAction({action:"sell",product,quantity,amount,date,volunteer,account}, "Consegna registrata e incasso contabilizzato.");}}>
     <div className="soci-grid">
      <label>Prodotto<select value={product} onChange={e=>chooseProduct(e.target.value as Product)}>
       <option value="panettone">Panettone · minimo 20 €</option><option value="candela">Candela · minimo 5 €</option>
      </select></label>
      <label>Quantità<input type="number" min={1} max={Math.max(1,available(product))} step={1} required value={quantity} onChange={e=>changeQty(Number(e.target.value))}/></label>
      <label>Contributo ricevuto (€)<input type="text" inputMode="decimal" required value={amount} onChange={e=>setAmount(e.target.value)} /></label>
      <label>Volontario che consegna<input required maxLength={120} value={volunteer} onChange={e=>setVolunteer(e.target.value)} placeholder="Nome del volontario"/></label>
      <label>Data<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>
      <label>Modalità incasso<select value={account} onChange={e=>setAccount(e.target.value as "cash"|"bank")}>
       <option value="cash">Contanti</option><option value="bank">Banca / bonifico</option>
      </select></label>
     </div>
     <p>Minimo per questa consegna: <strong>{money(minimum*100)}</strong>. Disponibilità residua: <strong>{available(product)}</strong>.</p>
     <button className="primary" type="submit" disabled={busy || available(product)<quantity || quantity<1 || !Number.isInteger(quantity) || !Number.isFinite(actual) || actual<minimum || !volunteer.trim()}>
      {busy?"Salvataggio…":"Registra consegna e incasso"}
     </button>
    </form>
    <details style={{marginTop:24}}>
     <summary><strong>Gestisci quantità disponibili</strong></summary>
     <p>Inserisci il totale dei prodotti ricevuti dall'associazione, non soltanto quelli rimasti. Le consegne vengono sottratte automaticamente. L'acquisto va registrato come spesa nella Contabilità.</p>
     <form onSubmit={e=>{e.preventDefault();void doAction({action:"stock",product:stockProduct,units:Number(units)},"Disponibilità aggiornata.");}}>
      <div className="soci-grid">
       <label>Prodotto<select value={stockProduct} onChange={e=>{const p=e.target.value as Product;setStockProduct(p);setUnits(String(total(p)));}}>
        <option value="panettone">Panettoni</option><option value="candela">Candele</option>
       </select></label>
       <label>Totale prodotti ricevuti<input type="number" min={sold(stockProduct)} max={1000000} step={1} required value={units} onChange={e=>setUnits(e.target.value)}/></label>
      </div>
      <button type="submit" disabled={busy || !Number.isInteger(Number(units)) || Number(units)<sold(stockProduct)}>Aggiorna disponibilità</button>
     </form>
    </details>
   </>}
   <h4 style={{marginTop:24}}>Ultime consegne</h4>
   {!sales.length?<p>Nessuna consegna registrata.</p>:
   <div className="soci-table-wrap"><table>
    <thead><tr><th>Data</th><th>Prodotto</th><th>Quantità</th><th>Volontario</th><th>Incasso</th><th>Stato</th>{canWrite&&<th>Operazione</th>}</tr></thead>
    <tbody>{sales.map(s=><tr key={s.id}>
     <td>{s.sale_date}</td><td>{name[s.product]}</td><td>{s.quantity}</td><td>{s.volunteer}</td><td>{money(s.amount_cents)}</td>
     <td>{s.cancelled_at?"Annullata":"Attiva"}</td>
     {canWrite&&<td>{!s.cancelled_at && <button type="button" disabled={busy} onClick={()=>{
      const reason=window.prompt("Motivo dell'annullamento (minimo 10 caratteri):");
      if(reason===null)return;
      if(reason.trim().length<10){setMessage("Indica almeno 10 caratteri.");return;}
      if(!window.confirm("Annullare consegna e movimento contabile collegato?"))return;
      void doAction({action:"cancel",product:s.product,sale_id:s.id,reason},"Consegna annullata, disponibilità ripristinata e contabilità aggiornata.");
     }}>Annulla</button>}</td>}
    </tr>)}</tbody>
   </table></div>}
  </>}
  {message&&<p className="soci-message" role="status">{message}</p>}
 </section>;
}
