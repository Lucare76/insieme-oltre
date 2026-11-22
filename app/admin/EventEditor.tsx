"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AssociationEvent } from "../../lib/events";
import { eventPath } from "../../lib/eventPages";

type Api = (path: string, init?: RequestInit) => Promise<Response>;

const emptyEvent = (): AssociationEvent => ({
  id: crypto.randomUUID(),
  slug: "",
  title: "",
  topicTitle: "",
  performerName: "",
  freeAdmission: false,
  eventDate: "",
  startTime: "10:00",
  endTime: "",
  locationName: "",
  address: "",
  shortDescription: "",
  description: "",
  imagePath: "",
  externalUrl: "",
  linkLabel: "",
  published: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export default function EventEditor({ api }: { api: Api }) {
  const [items, setItems] = useState<AssociationEvent[]>([]);
  const [editing, setEditing] = useState<AssociationEvent | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await api("events");
    const data = await response.json();
    setItems(data.items ?? []);
  }, [api]);

  useEffect(() => { void load().catch((error) => setStatus(error instanceof Error ? error.message : "Caricamento non riuscito.")); }, [load]);

  const todayRome = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
  const sorted = useMemo(
    () => [...items].sort((a, b) => (b.eventDate + b.startTime).localeCompare(a.eventDate + a.startTime)),
    [items],
  );

  async function save(next: AssociationEvent[]) {
    setBusy(true);
    setStatus("");
    try {
      const response = await api("events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: next }),
      });
      const data = await response.json();
      setItems(data.items ?? next);
      setEditing(null);
      setStatus("Appuntamenti salvati.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Salvataggio non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    const form = new FormData();
    form.append("image", file);
    const response = await api("events/image", { method: "POST", body: form });
    const data = await response.json();
    if (!data.path) throw new Error("Caricamento non riuscito.");
    setEditing((current) => current ? { ...current, imagePath: data.path } : current);
  }

  function persistEditor() {
    if (!editing) return;
    const next = items.some((item) => item.id === editing.id)
      ? items.map((item) => item.id === editing.id ? { ...editing, updatedAt: new Date().toISOString() } : item)
      : [...items, { ...editing, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
    void save(next);
  }

  function remove(item: AssociationEvent) {
    if (!window.confirm(`Eliminare “${item.title}”? L’operazione non può essere annullata.`)) return;
    void save(items.filter((event) => event.id !== item.id));
  }

  return (
    <section className="events-admin">
      <div className="events-admin-head">
        <div>
          <p className="soci-kicker">VITA ASSOCIATIVA</p>
          <h2>Appuntamenti</h2>
          <p>Gestisci gli incontri che compaiono sul sito. I passati vengono archiviati automaticamente.</p>
        </div>
        <button className="primary" type="button" onClick={() => setEditing(emptyEvent())}>+ Nuovo appuntamento</button>
      </div>

      {status && <p className="soci-message" role="status">{status}</p>}

      {editing && (
        <div className="soci-card events-editor-card">
          <div className="events-editor-title">
            <div>
              <p className="soci-kicker">{items.some((item) => item.id === editing.id) ? "MODIFICA" : "NUOVO"}</p>
              <h3>{editing.title || "Nuovo appuntamento"}</h3>
            </div>
            <button type="button" onClick={() => setEditing(null)}>Chiudi</button>
          </div>
          <div className="events-form-grid">
            <label>Titolo<input required maxLength={120} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })}/></label>
            <label>Titolo specifico incontro <small>facoltativo, es. Giornata dei nostri bambini</small><input maxLength={120} value={editing.topicTitle} onChange={(e) => setEditing({ ...editing, topicTitle: e.target.value })}/></label>
            <label>Data<input type="date" required value={editing.eventDate} onChange={(e) => setEditing({ ...editing, eventDate: e.target.value })}/></label>
            <label>Ora inizio<input type="time" required value={editing.startTime} onChange={(e) => setEditing({ ...editing, startTime: e.target.value })}/></label>
            <label>Ora fine <small>facoltativa</small><input type="time" value={editing.endTime} onChange={(e) => setEditing({ ...editing, endTime: e.target.value })}/></label>
            <label>Chi conduce l'incontro <small>facoltativo, es. Dott.ssa Federica Fornario</small><input maxLength={140} value={editing.performerName} onChange={(e) => setEditing({ ...editing, performerName: e.target.value })}/></label>
            <label className="soci-check wide"><input type="checkbox" checked={editing.freeAdmission} onChange={(e) => setEditing({ ...editing, freeAdmission: e.target.checked })}/> Partecipazione gratuita (confermata)</label>
            <label>Luogo<input required maxLength={140} value={editing.locationName} onChange={(e) => setEditing({ ...editing, locationName: e.target.value })}/></label>
            <label>Indirizzo <small>inserisci via, numero e comune se conosciuti; per iniziative itineranti lascia vuoto e indica il comune nel campo Luogo</small><input maxLength={220} value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })}/></label>
            <label className="wide">Breve descrizione <small>anticipazione mostrata nell’elenco</small><textarea required maxLength={320} value={editing.shortDescription} onChange={(e) => setEditing({ ...editing, shortDescription: e.target.value })}/></label>
            <label className="wide">Racconto completo <small>per la pagina dedicata · separa i paragrafi con una riga vuota</small><textarea maxLength={4000} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })}/></label>
            <label>Link esterno <small>facoltativo</small><input type="url" maxLength={500} value={editing.externalUrl} onChange={(e) => setEditing({ ...editing, externalUrl: e.target.value })}/></label>
            <label>Testo pulsante <small>facoltativo</small><input maxLength={80} value={editing.linkLabel} onChange={(e) => setEditing({ ...editing, linkLabel: e.target.value })}/></label>
            <label className="wide">Locandina <small>JPG, PNG o WEBP fino a 5 MB</small>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file).catch((error) => setStatus(error.message));
              }}/>
            </label>
            {editing.imagePath && <div className="events-image-preview wide"><Image src={editing.imagePath} alt="Anteprima locandina" width={180} height={240} unoptimized/><button type="button" onClick={() => setEditing({ ...editing, imagePath: "" })}>Rimuovi immagine</button></div>}
            <label className="soci-check wide"><input type="checkbox" checked={editing.published} onChange={(e) => setEditing({ ...editing, published: e.target.checked })}/> Pubblicato sul sito</label>
          </div>
          <div className="soci-actions">
            <button className="primary" type="button" disabled={busy} onClick={persistEditor}>{busy ? "Salvataggio…" : "Salva appuntamento"}</button>
            <button type="button" onClick={() => setEditing(null)}>Annulla</button>
          </div>
        </div>
      )}

      <div className="events-admin-list">
        {sorted.length === 0 ? <div className="soci-card"><p>Nessun appuntamento inserito.</p></div> : sorted.map((item) => (
          <article className="events-admin-row" key={item.id}>
            <div className="events-admin-date"><strong>{item.eventDate.split("-").reverse().slice(0,2).join("/")}</strong><span>{item.startTime}</span></div>
            <div className="events-admin-copy"><div className="events-admin-status"><span className={item.published ? "is-live" : ""}>{item.published ? "Pubblicato" : "Bozza"}</span><span>{item.eventDate === todayRome ? "Oggi" : item.eventDate > todayRome ? "Futuro" : "Passato"}</span></div><h3>{item.topicTitle ? `${item.topicTitle} · ${item.title}` : item.title}</h3><p>{item.locationName}</p></div>
            <div className="soci-actions">{item.published && <a href={eventPath(item)} target="_blank" rel="noopener noreferrer">Apri / condividi</a>}<button type="button" onClick={() => setEditing(item)}>Modifica</button><button type="button" onClick={() => remove(item)}>Elimina</button></div>
          </article>
        ))}
      </div>
    </section>
  );
}
