"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import "../../area-soci/soci.css";
import "./libri-sociali.css";

const MembershipFees = dynamic(() => import("./MembershipFees"), { loading: () => <p>Caricamento quote…</p> });
const MembershipAccountMatches = dynamic(() => import("./MembershipAccountMatches"), { loading: () => <p>Caricamento contatti…</p> });
const MembershipCards = dynamic(() => import("./MembershipCards"), { loading: () => <p>Caricamento tessere…</p> });
const SignedDocumentsPanel = dynamic(() => import("./SignedDocumentsPanel"), { loading: () => <p>Caricamento documenti…</p> });
const MinuteDistribution = dynamic(() => import("./MinuteDistribution"), { loading: () => <p>Caricamento invii…</p> });

type Kind = "soci" | "volontari" | "assemblee" | "direttivo";
type View = "registro" | "quote" | "tessere" | "contatti" | "documenti" | "invio";
type Entry = {
 id: string; full_name?: string; title?: string; admitted_on?: string;
 birth_date?: string | null; ended_on?: string | null; meeting_on?: string;
 approved?: boolean;
};
type NameCorrection = { person_id: string; old_name: string; new_name: string; reason: string; changed_at: string };
type NameEdit = { id: string; expected_name: string; full_name: string; reason: string; confirmed: boolean };
type Feedback = { text: string; tone: "success" | "error" };
const initial = {
 full_name: "", admitted_on: "", birth_date: "", fiscal_code: "", ended_on: "",
 notes: "", insurance_reference: "", meeting_on: "", title: "", attendees: "",
 content: "", approved: false,
};
const registry: Record<Kind, { title: string; subtitle: string; description: string; singular: string }> = {
 soci: {
  title: "Libro soci", subtitle: "Anagrafica, quote e tessere",
  description: "Ammissioni e stato dei soci. Quote, tessere e recapiti si gestiscono dalle sezioni dedicate.",
  singular: "socio",
 },
 volontari: {
  title: "Registro volontari", subtitle: "Persone, attività e coperture",
  description: "Iscrizioni dei volontari, date di attività e riferimenti assicurativi.",
  singular: "volontario",
 },
 assemblee: {
  title: "Verbali assemblee", subtitle: "Riunioni e comunicazioni",
  description: "Verbali delle assemblee, approvazioni e distribuzione dei documenti.",
  singular: "verbale",
 },
 direttivo: {
  title: "Verbali direttivo", subtitle: "Decisioni e documenti",
  description: "Archivio delle riunioni e delle decisioni del Consiglio direttivo.",
  singular: "verbale",
 },
};
const kinds = Object.keys(registry) as Kind[];
const tabs: Record<Kind, { id: View; title: string; caption: string }[]> = {
 soci: [
  { id: "registro", title: "Anagrafica soci", caption: "Iscrizioni e nominativi" },
  { id: "quote", title: "Quote associative", caption: "Pagamenti e ricevute" },
  { id: "tessere", title: "Tessere digitali", caption: "Tessere con QR" },
  { id: "contatti", title: "Email e accessi", caption: "Rubrica e collegamenti" },
  { id: "documenti", title: "Documenti firmati", caption: "Archivio digitale" },
 ],
 volontari: [
  { id: "registro", title: "Registro volontari", caption: "Persone e assicurazione" },
  { id: "documenti", title: "Documenti firmati", caption: "Archivio digitale" },
 ],
 assemblee: [
  { id: "registro", title: "Verbali assemblee", caption: "Consulta e registra" },
  { id: "invio", title: "Invio ai soci", caption: "Distribuzione verbali" },
  { id: "documenti", title: "Documenti firmati", caption: "Archivio digitale" },
 ],
 direttivo: [
  { id: "registro", title: "Verbali direttivo", caption: "Consulta e registra" },
  { id: "documenti", title: "Documenti firmati", caption: "Archivio digitale" },
 ],
};
const todayRome = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
const dateLabel = (date?: string | null) =>
 date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split("-").reverse().join("/") : "—";
const personKind = (k: Kind) => k === "soci" || k === "volontari";

export default function Page() {
 const [kind, setKind] = useState<Kind>("soci");
 const [view, setView] = useState<View>("registro");
 const [data, setData] = useState(initial);
 const [items, setItems] = useState<Entry[]>([]);
 const [corrections, setCorrections] = useState<NameCorrection[]>([]);
 const [nameEdit, setNameEdit] = useState<NameEdit | null>(null);
 const [authorized, setAuthorized] = useState(false);
 const [loading, setLoading] = useState(true);
 const [busy, setBusy] = useState(false);
 const [feedback, setFeedback] = useState<Feedback | null>(null);
 const [search, setSearch] = useState("");
 const [editorOpen, setEditorOpen] = useState(false);
 const submission = useRef(false);

 const api = useCallback(async (url: string, init: RequestInit = {}) => {
  const saved = JSON.parse(localStorage.getItem("insieme_oltre_admin_session") || "null");
  if (!saved?.access_token || saved.expires_at * 1000 < Date.now())
   throw new Error("Sessione scaduta. Accedi nuovamente dall'area amministrativa.");
  const response = await fetch(url, {
   ...init, cache: "no-store",
   headers: { ...init.headers, Authorization: "Bearer " + saved.access_token },
  });
  if (!response.ok) {
   const body = await response.json().catch(() => ({}));
   throw new Error(body.error || "Operazione non riuscita.");
  }
  return response;
 }, []);

 const fetchRecords = useCallback(async (target: Kind) => {
  const response = await api("/api/associazione/libri-sociali?kind=" + target);
  const records = await response.json() as { items: Entry[]; corrections?: NameCorrection[] };
  return { items: records.items, corrections: records.corrections || [] };
 }, [api]);

 useEffect(() => {
  let active = true;
  (async () => {
   try {
    const me = await (await api("/api/associazione/me")).json();
    if (!["owner", "president", "accountant"].includes(me.user.role))
     throw new Error("Accesso riservato ad amministrazione, presidente e tesoriere.");
    const result = await fetchRecords(kind);
    if (active) {
     setAuthorized(true); setItems(result.items); setCorrections(result.corrections);
     setFeedback(null);
    }
   } catch (error) {
    if (active) {
     setAuthorized(false);
     setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Accesso non disponibile." });
    }
   } finally {
    if (active) setLoading(false);
   }
  })();
  return () => { active = false; };
 }, [api, fetchRecords, kind]);

 async function refresh() {
  const result = await fetchRecords(kind);
  setItems(result.items);
  setCorrections(result.corrections);
 }
 function changeKind(next: Kind) {
  if (next === kind) return;
  setLoading(true); setKind(next); setView("registro"); setSearch("");
  setEditorOpen(false); setNameEdit(null); setData(initial); setFeedback(null);
 }
 function showCreate() {
  if (editorOpen) { setEditorOpen(false); return; }
  setEditorOpen(true);
  requestAnimationFrame(() => document.getElementById("books-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }));
 }
 async function save(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (submission.current) return;
  submission.current = true;
  setBusy(true); setFeedback(null);
  let persisted = false;
  try {
   await api("/api/associazione/libri-sociali", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, kind }),
   });
   persisted = true;
   setData(initial); setEditorOpen(false);
   await refresh();
   setFeedback({ tone: "success", text: "Registrazione salvata nel registro ufficiale." });
  } catch (error) {
   setFeedback({
    tone: persisted ? "success" : "error",
    text: persisted
     ? "Registrazione salvata, ma aggiornamento dell'elenco non riuscito. Aggiorna l'elenco prima di riprovare: non creare un doppione."
     : error instanceof Error ? error.message : "Salvataggio non riuscito.",
   });
  } finally { setBusy(false); submission.current = false; }
 }
 async function correctName(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (!nameEdit || busy) return;
  setBusy(true); setFeedback(null);
  let persisted = false;
  try {
   await api("/api/associazione/libri-sociali", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
     kind: "soci", person_id: nameEdit.id, expected_name: nameEdit.expected_name,
     full_name: nameEdit.full_name, reason: nameEdit.reason, confirm: nameEdit.confirmed,
    }),
   });
   persisted = true;
   await refresh(); setNameEdit(null);
   setFeedback({ tone: "success", text: "Nominativo corretto. Quote, ricevute e collegamenti restano associati alla stessa persona." });
  } catch (error) {
   setFeedback({ tone: persisted ? "success" : "error",
    text: persisted ? "Correzione salvata: non ripetere l'operazione. Aggiorna l'elenco."
     : error instanceof Error ? error.message : "Correzione non riuscita." });
  } finally { setBusy(false); }
 }
 async function exportPdf() {
  setBusy(true); setFeedback(null);
  try {
   const blob = await (await api("/api/associazione/libri-sociali?kind=" + kind + "&format=pdf")).blob();
   const url = URL.createObjectURL(blob);
   const anchor = document.createElement("a");
   anchor.href = url; anchor.download = "insieme-oltre-" + kind + ".pdf"; anchor.click();
   setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
   setFeedback({ tone: "error", text: error instanceof Error ? error.message : "PDF non disponibile." });
  } finally { setBusy(false); }
 }
 async function reload() {
  setBusy(true); setFeedback(null);
  try { await refresh(); setFeedback({ tone: "success", text: "Registro aggiornato." }); }
  catch (error) { setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Impossibile aggiornare il registro." }); }
  finally { setBusy(false); }
 }
 const isPerson = personKind(kind);
 const ended = isPerson ? items.filter(i => !!i.ended_on && i.ended_on <= todayRome()).length : 0;
 const approved = !isPerson ? items.filter(i => i.approved === true).length : 0;
 const filtered = useMemo(() => items.filter(i => {
  const target = isPerson ? i.full_name : i.title;
  return (target || "").toLocaleLowerCase("it").includes(search.trim().toLocaleLowerCase("it"));
 }), [items, isPerson, search]);
 const currentView = tabs[kind].find(v => v.id === view) || tabs[kind][0];
 const input = (key: keyof typeof initial, label: string, required = false, variant = "text") =>
  <label key={key}>{label}
   <input type={variant} required={required} maxLength={variant === "text" ? 500 : undefined}
    value={String(data[key])} onChange={event => setData(old => ({ ...old, [key]: event.target.value }))}/>
  </label>;

 return <main className="soci books-page"><div className="soci-shell">
  <header className="books-header">
   <Link className="books-brand" href="/"><Image src="/insieme-oltre-logo.png" alt="Insieme Oltre" width={140} height={104}/></Link>
   <div className="books-header-copy">
    <p className="soci-kicker">INSIEME OLTRE ODV · AREA RISERVATA</p>
    <h1>Libri sociali</h1>
    <p>Uno spazio ordinato per soci, volontari, verbali e documenti ufficiali.</p>
   </div>
   <Link className="books-return" href="/admin">← Torna all'amministrazione</Link>
  </header>

  {feedback && <p className="books-feedback" data-tone={feedback.tone} role={feedback.tone === "error" ? "alert" : "status"}>{feedback.text}</p>}
  {!authorized && loading ? <div className="books-loading" role="status">Verifica dei permessi e caricamento registri…</div> :
   !authorized ? <div className="books-loading">
    <p>Non è stato possibile aprire i registri.</p>
    <Link href="/admin">Torna all'area riservata</Link>
   </div> : <>
    <div className="books-intro">
     <div><p className="soci-kicker">AMMINISTRAZIONE ASSOCIATIVA</p><h2>Scegli l'archivio da gestire</h2></div>
     <p>Ogni sezione contiene soltanto gli strumenti di cui hai bisogno.</p>
    </div>
    <nav className="books-topnav" aria-label="Archivi sociali">
     {kinds.map(k => <button key={k} type="button" aria-pressed={kind === k} onClick={() => changeKind(k)}>
      <span className="books-nav-title">{registry[k].title}</span>
      <span className="books-nav-desc">{registry[k].subtitle}</span>
     </button>)}
    </nav>
    <div className="books-workspace">
     <aside className="books-sidebar">
      <h2>Strumenti</h2>
      <nav className="books-side-items" aria-label="Strumenti del registro">
       {tabs[kind].map((tab, index) => <button type="button" key={tab.id} aria-pressed={view === tab.id}
        title={tab.caption} onClick={() => {setView(tab.id); setEditorOpen(false); setNameEdit(null); setFeedback(null);}}>
        <span className="books-side-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <span>{tab.title}</span>
       </button>)}
      </nav>
      <div className="books-side-help">
       <strong>Documenti ufficiali</strong>
       <p>Le registrazioni rimangono distinte dagli account digitali. Le operazioni sensibili conservano le verifiche esistenti.</p>
      </div>
     </aside>
     <div className="books-main">
      {loading ? <div className="books-loading" role="status">Caricamento del registro selezionato…</div> :
       view === "registro" ? <section className="books-panel" aria-label={registry[kind].title}>
        <div className="books-heading">
         <div>
          <p className="soci-kicker">REGISTRO UFFICIALE</p>
          <h2>{registry[kind].title}</h2>
          <p>{registry[kind].description}</p>
         </div>
         <div className="books-heading-actions">
          <button type="button" disabled={busy} onClick={() => void reload()}>Aggiorna</button>
          <button type="button" disabled={busy || items.length === 0} onClick={() => void exportPdf()}>Esporta PDF</button>
          <button type="button" className="primary" disabled={busy} aria-expanded={editorOpen} onClick={showCreate}>
           {editorOpen ? "Chiudi modulo" : isPerson ? "+ Aggiungi persona" : "+ Nuovo verbale"}
          </button>
         </div>
        </div>
        <div className="books-metrics" aria-label="Riepilogo archivio">
         <div className="books-metric"><span>{isPerson ? "Registrazioni" : "Verbali archiviati"}</span><strong>{items.length}</strong></div>
         <div className="books-metric"><span>{isPerson ? "Attivi" : "Approvati"}</span><strong>{isPerson ? items.length - ended : approved}</strong></div>
         <div className="books-metric"><span>{isPerson ? "Cessati" : "Da approvare"}</span><strong>{isPerson ? ended : items.length - approved}</strong></div>
        </div>
        {editorOpen && <section className="books-editor" id="books-editor" aria-label="Nuova registrazione">
         <div className="books-editor-heading"><div>
          <h3>{isPerson ? "Inserisci " + (kind === "soci" ? "un socio" : "un volontario") : "Registra un verbale"}</h3>
          <p>Compila i campi richiesti. I documenti si gestiscono nella sezione dedicata.</p>
         </div><button type="button" onClick={() => setEditorOpen(false)}>Chiudi</button></div>
         <form onSubmit={event => void save(event)}>
          <div className="books-form-grid">
           {isPerson ? <>
            {input("full_name", "Nome e cognome", true)}
            {input("admitted_on", kind === "soci" ? "Data di ammissione" : "Inizio attività", true, "date")}
            {input("birth_date", "Data di nascita", false, "date")}
            {input("fiscal_code", "Codice fiscale")}
            {input("ended_on", kind === "soci" ? "Data cessazione (facoltativa)" : "Fine attività (facoltativa)", false, "date")}
            {kind === "volontari" && input("insurance_reference", "Riferimento assicurativo")}
            <label className="books-wide">Note<textarea maxLength={500} value={data.notes}
             onChange={event => setData(d => ({ ...d, notes: event.target.value }))}/></label>
           </> : <>
            {input("meeting_on", "Data della riunione", true, "date")}
            {input("title", "Oggetto", true)}
            <label className="books-wide">Partecipanti<textarea required maxLength={4000} value={data.attendees}
             onChange={event => setData(d => ({ ...d, attendees: event.target.value }))}/></label>
            <label className="books-wide">Testo del verbale<textarea required rows={9} maxLength={20000} value={data.content}
             onChange={event => setData(d => ({ ...d, content: event.target.value }))}/></label>
            <label className="soci-check books-wide"><input type="checkbox" checked={data.approved}
             onChange={event => setData(d => ({ ...d, approved: event.target.checked }))}/>
             Verbale già approvato dagli organi competenti</label>
           </>}
          </div>
          <div className="books-editor-foot">
           <button className="primary" type="submit" disabled={busy}>{busy ? "Salvataggio…" : "Salva nel registro"}</button>
           <button type="button" disabled={busy} onClick={() => setEditorOpen(false)}>Annulla</button>
          </div>
         </form>
        </section>}
        <div className="books-list-heading"><h3>Elenco {isPerson ? "persone" : "verbali"}</h3><p>{filtered.length} di {items.length} registrazioni</p></div>
        <label className="books-search-label">Cerca per {isPerson ? "nome e cognome" : "oggetto"}
         <input type="search" autoComplete="off" value={search} onChange={event => setSearch(event.target.value)}
          placeholder={isPerson ? "Cerca un nominativo…" : "Cerca un verbale…"} />
        </label>
        {filtered.length === 0 ? <div className="books-empty">
         <strong>{items.length === 0 ? "Il registro è ancora vuoto" : "Nessun risultato"}</strong>
         <p>{items.length === 0 ? "Aggiungi la prima registrazione quando disponi delle informazioni ufficiali." : "Prova con un'altra ricerca o cancella il filtro."}</p>
        </div> : <div className="books-table-wrap"><table className="books-table">
         <thead><tr><th scope="col">{isPerson ? "Nominativo" : "Oggetto"}</th>
          <th scope="col">{isPerson ? "Ammissione / inizio" : "Data riunione"}</th>
          <th scope="col">Stato</th>{kind === "soci" && <th scope="col">Operazioni</th>}
         </tr></thead>
         <tbody>{filtered.map(item => {
          const endedEntry = !!item.ended_on && item.ended_on <= todayRome();
          const status = isPerson ? endedEntry ? "Cessato" : "Attivo" : item.approved ? "Approvato" : "Da approvare";
          const muted = isPerson ? endedEntry : !item.approved;
          return <tr key={item.id}>
           <td data-label={isPerson ? "Nominativo" : "Oggetto"}>
            <span className="books-person-name">{isPerson ? item.full_name : item.title}</span>
           </td>
           <td data-label={isPerson ? "Data" : "Riunione"}>{dateLabel(isPerson ? item.admitted_on : item.meeting_on)}</td>
           <td data-label="Stato"><span className={"books-pill" + (muted ? " books-pill-muted" : "")}>{status}</span></td>
           {kind === "soci" && <td data-label="Operazioni">
            {item.full_name && <button type="button" className="books-inline-action" disabled={busy}
             onClick={() => { setNameEdit(current => current?.id === item.id ? null : {
              id: item.id, expected_name: item.full_name || "", full_name: item.full_name || "",
              reason: "Correzione errore di digitazione", confirmed: false,
             }); setFeedback(null); }}>
             {nameEdit?.id === item.id ? "Chiudi" : "Correggi nome"}
            </button>}
           </td>}
           {nameEdit?.id === item.id && kind === "soci" && <td className="books-edit-cell" colSpan={4} data-label="Correzione">
            <form className="books-edit-box" onSubmit={event => void correctName(event)}>
             <h4>Correggi il nominativo</h4>
             <p>Nome attuale: <strong>{nameEdit.expected_name}</strong>. Questa operazione non sostituisce il socio e non modifica quote o ricevute.</p>
             <div className="books-form-grid">
              <label>Nome e cognome corretti
               <input required maxLength={160} value={nameEdit.full_name}
                onChange={event => setNameEdit(d => d ? ({ ...d, full_name: event.target.value, confirmed: false }) : null)}/>
              </label>
              <label>Motivo della correzione
               <input required minLength={5} maxLength={300} value={nameEdit.reason}
                onChange={event => setNameEdit(d => d ? ({ ...d, reason: event.target.value, confirmed: false }) : null)}/>
              </label>
             </div>
             <label className="soci-check"><input type="checkbox" checked={nameEdit.confirmed}
              onChange={event => setNameEdit(d => d ? ({ ...d, confirmed: event.target.checked }) : null)}/>
              Confermo che si tratta della stessa persona.</label>
             <p className="books-subtle-note">L'operazione è tracciata nello storico. I PDF già spediti non vengono modificati retroattivamente.</p>
             <div className="books-edit-actions">
              <button type="submit" className="primary" disabled={busy || !nameEdit.confirmed ||
               nameEdit.full_name.trim().length < 2 || nameEdit.full_name.trim() === nameEdit.expected_name ||
               nameEdit.reason.trim().length < 5}>Conferma correzione</button>
              <button type="button" disabled={busy} onClick={() => setNameEdit(null)}>Annulla</button>
             </div>
            </form>
           </td>}
          </tr>;
         })}</tbody>
        </table></div>}
        {kind === "soci" && corrections.length > 0 && <details className="books-activity">
         <summary>Storico correzioni dei nominativi ({corrections.length})</summary>
         <ul>{corrections.map((c, i) => <li key={c.person_id + c.changed_at + i}>
          {new Date(c.changed_at).toLocaleString("it-IT", { timeZone: "Europe/Rome" })} · <strong>{c.old_name}</strong> → <strong>{c.new_name}</strong> · {c.reason}
         </li>)}</ul>
        </details>}
        <p className="books-subtle-note">Il PDF è un'esportazione dei dati del registro. Non sostituisce l'approvazione dei verbali o la vidimazione prevista per i volontari.</p>
       </section> : <section className="books-panel books-embedded-panel" aria-label={currentView.title}>
        <div className="books-heading">
         <div><p className="soci-kicker">{registry[kind].title.toUpperCase()}</p><h2>{currentView.title}</h2>
          <p>{currentView.caption}. Gli strumenti sottostanti mantengono le procedure e le autorizzazioni attuali.</p>
         </div>
        </div>
        {kind === "soci" && view === "quote" && <MembershipFees />}
        {kind === "soci" && view === "tessere" && <MembershipCards people={items} />}
        {kind === "soci" && view === "contatti" && <MembershipAccountMatches />}
        {view === "documenti" && <SignedDocumentsPanel kind={kind} />}
        {kind === "assemblee" && view === "invio" && <MinuteDistribution minutes={items} />}
       </section>}
     </div>
    </div>
   </>}
 </div></main>;
}
