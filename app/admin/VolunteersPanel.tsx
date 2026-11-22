"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Volunteer = {
  id: string; name: string; email: string; phone: string;
  status: "new" | "contacted" | "available" | "active" | "closed";
  availability: string; notes: string; source: "site" | "manual";
  association_role: "volontario" | "socio" | "socio_volontario"; member_person_id: string | null;
  created_at: string;
};
type Api = (path: string, init?: RequestInit) => Promise<Response>;
const statuses = [
  ["new", "Da contattare"], ["contacted", "Contattato"],
  ["available", "Disponibile"], ["active", "Attivo"], ["closed", "Archiviato"],
] as const;
const empty = { name: "", email: "", phone: "", status: "new" as Volunteer["status"], availability: "", notes: "" };

export default function VolunteersPanel({ api }: { api: Api }) {
  const [items, setItems] = useState<Volunteer[]>([]);
  const [form, setForm] = useState<Partial<Volunteer>>(empty);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [rolePerson, setRolePerson] = useState<Volunteer | null>(null);
  const [nextRole, setNextRole] = useState<"socio" | "socio_volontario">("socio");
  const [admittedOn, setAdmittedOn] = useState("");
  const [confirmedAdmission, setConfirmedAdmission] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const load = useCallback(async () => {
    const res = await api("volontari");
    const data = await res.json() as { items: Volunteer[] };
    setItems(data.items);
  }, [api]);
  useEffect(() => {
    let active = true;
    api("volontari").then(res => res.json()).then((data: { items: Volunteer[] }) => {
      if (active) setItems(data.items);
    }).catch(() => { if (active) setFeedback("Impossibile caricare le candidature. Verifica che la migrazione Supabase sia stata applicata."); });
    return () => { active = false; };
  }, [api]);
  const visible = useMemo(() => items.filter(item =>
    (filter === "all" || item.status === filter) &&
    [item.name, item.email, item.phone].some(value => value.toLowerCase().includes(search.toLowerCase().trim()))
  ), [items, filter, search]);

  async function changeRole(event: React.FormEvent) {
    event.preventDefault();
    if (!rolePerson || busy) return;
    setBusy(true); setFeedback("");
    let saved = false;
    try {
      await api("volontari", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_role", id: rolePerson.id, association_role: nextRole,
          admitted_on: admittedOn, confirm_admission: confirmedAdmission,
        }),
      });
      saved = true;
      setRolePerson(null);
      try {
        await load();
        setFeedback("Ruolo aggiornato. " + (rolePerson.member_person_id ? "Il Libro soci non è stato duplicato." : "Ammissione registrata nel Libro soci."));
      } catch {
        setFeedback("Cambio ruolo salvato. Aggiorna l'elenco prima di riprovare per evitare duplicati.");
      }
    } catch (error) {
      setFeedback(saved ? "Cambio salvato, aggiorna l'elenco." :
        error instanceof Error ? error.message : "Cambio ruolo non riuscito.");
    } finally { setBusy(false); }
  }

  function openRole(person: Volunteer) {
    setRolePerson(person);
    setNextRole(person.association_role === "socio_volontario" ? "socio_volontario" : "socio");
    setAdmittedOn("");
    setConfirmedAdmission(false);
    setFeedback("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setFeedback("");
    try {
      await api("volontari", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...(editing ? { id: editing } : {}) }) });
      setEditing(null); setForm(empty);
      try { await load(); setFeedback("Candidatura salvata."); }
      catch { setFeedback("Salvataggio effettuato: ricarica l'elenco prima di riprovare."); }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Salvataggio non riuscito.");
    } finally { setBusy(false); }
  }

  return <section className="volunteers-admin">
    <header className="events-admin-head">
      <div><p className="soci-kicker">VITA ASSOCIATIVA</p>
        <h2>Candidature volontari</h2>
        <p>Organizza le persone che desiderano aiutare Insieme Oltre. Questa lista non equivale all'iscrizione nel registro ufficiale dei volontari.</p>
      </div>
    </header>
    <div className="volunteers-summary" aria-label="Riepilogo candidature">
      <strong>{items.length} candidature</strong>
      <span>{items.filter(x => x.status === "new").length} da contattare</span>
      <span>{items.filter(x => x.status === "available").length} disponibili</span>
    </div>
    {feedback && <p role="status" className="soci-message">{feedback}</p>}
    {rolePerson && (
      <div className="soci-card" id="volunteer-role-editor">
        <h3>Cambio ruolo associativo · {rolePerson.name}</h3>
        <p>Il ruolo non è un permesso di accesso al gestionale. L'ammissione come socio deve risultare approvata secondo lo statuto.</p>
        <form className="volunteers-form" onSubmit={changeRole}>
          <label>Ruolo associativo
            <select value={nextRole} onChange={e => setNextRole(e.target.value as "socio" | "socio_volontario")}>
              <option value="socio">Socio</option>
              <option value="socio_volontario">Socio e volontario</option>
            </select>
          </label>
          {!rolePerson.member_person_id && <>
            <label>Data effettiva di ammissione
              <input type="date" required value={admittedOn}
                max={new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date())}
                onChange={e => setAdmittedOn(e.target.value)}/>
            </label>
            <label className="soci-check wide">
              <input type="checkbox" required checked={confirmedAdmission}
                onChange={e => setConfirmedAdmission(e.target.checked)}/>
              Confermo che l'ammissione è stata approvata secondo lo statuto e che il nominativo non è già nel Libro soci.
            </label>
          </>}
          <p className="wide">Il cambio aggiorna la scheda e, per un nuovo socio, registra l'ammissione nel Libro soci. L'eventuale iscrizione nel Registro volontari e la copertura assicurativa si gestiscono separatamente.</p>
          <div className="soci-actions wide">
            <button className="primary" type="submit" disabled={busy}>{busy ? "Salvataggio…" : "Conferma cambio ruolo"}</button>
            <button type="button" disabled={busy} onClick={() => setRolePerson(null)}>Annulla</button>
          </div>
        </form>
      </div>
    )}
    <div className="soci-card">
      <h3>{editing ? "Modifica candidatura" : "Aggiungi una persona"}</h3>
      <form onSubmit={save} className="volunteers-form">
        <label>Nome e cognome<input required maxLength={120} value={form.name ?? ""} onChange={e => setForm(x => ({ ...x, name: e.target.value }))}/></label>
        <label>Email<input type="email" required maxLength={254} value={form.email ?? ""} onChange={e => setForm(x => ({ ...x, email: e.target.value }))}/></label>
        <label>Telefono<input type="tel" maxLength={40} value={form.phone ?? ""} onChange={e => setForm(x => ({ ...x, phone: e.target.value }))}/></label>
        <label>Stato<select value={form.status ?? "new"} onChange={e => setForm(x => ({ ...x, status: e.target.value as Volunteer["status"] }))}>
          {statuses.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label className="wide">Disponibilità<textarea rows={2} maxLength={500} placeholder="Es. gazebo, eventi, scuole, raccolte fondi; giorni e orari" value={form.availability ?? ""} onChange={e => setForm(x => ({ ...x, availability: e.target.value }))}/></label>
        <label className="wide">Note interne<textarea rows={3} maxLength={1000} value={form.notes ?? ""} onChange={e => setForm(x => ({ ...x, notes: e.target.value }))}/></label>
        <div className="soci-actions wide">
          <button className="primary" disabled={busy} type="submit">{busy ? "Salvataggio…" : editing ? "Salva modifiche" : "Aggiungi candidatura"}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setForm(empty); }}>Annulla</button>}
        </div>
      </form>
    </div>
    <div className="soci-card">
      <div className="volunteers-tools">
        <label>Cerca<input type="search" placeholder="Nome, email o telefono" value={search} onChange={e => setSearch(e.target.value)}/></label>
        <label>Stato<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Tutti</option>{statuses.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="button" onClick={() => void load().catch(() => setFeedback("Aggiornamento non riuscito."))}>Aggiorna</button>
      </div>
      <div className="volunteers-list">
        {visible.map(person => <article key={person.id} className="volunteers-entry">
          <div><strong>{person.name}</strong><small>{statuses.find(x => x[0] === person.status)?.[1]} · {new Date(person.created_at).toLocaleDateString("it-IT")} · {person.source === "site" ? "Dal sito" : "Inserimento manuale"}</small>
            <p><a href={`mailto:${person.email}`}>{person.email}</a>{person.phone && <> · <a href={`tel:${person.phone.replace(/[^+\d]/g,"")}`}>{person.phone}</a></>}</p>
            {person.availability && <p><b>Disponibilità:</b> {person.availability}</p>}
            <p><b>Ruolo:</b> {person.association_role === "socio_volontario" ? "Socio e volontario" : person.association_role === "socio" ? "Socio" : "Volontario (candidatura)"}{person.member_person_id ? " · Libro soci collegato" : ""}</p>
            {person.notes && <p><b>Note:</b> {person.notes}</p>}
          </div>
          <div className="volunteers-entry-actions">
            <button type="button" onClick={() => { setEditing(person.id); setForm(person); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Gestisci</button>
            <button type="button" onClick={() => { openRole(person); requestAnimationFrame(() => document.getElementById("volunteer-role-editor")?.scrollIntoView({ behavior: "smooth", block: "start" })); }}>Cambia ruolo</button>
          </div>
        </article>)}
        {!visible.length && <p>Nessuna candidatura corrisponde ai filtri selezionati.</p>}
      </div>
    </div>
  </section>;
}
