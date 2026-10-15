"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ages, priorities, roles } from "../../../lib/participation";
import "../admin.css";
import "./risposte.css";

type Item = { id: string; created_at: string; role: string; age: string; interests: string[]; idea: string | null };
type Result = { items: Item[]; total: number; limited: boolean };
const roleLabel = (v: string) => roles.find((x) => x.value === v)?.label || v;
const ageLabel = (v: string) => ages.find((x) => x.value === v)?.label || v;
const activityLabel = (v: string) => priorities.find((x) => x.value === v)?.title || v;

function csvCell(value: string) {
  // Protezione formula injection quando un campo libero viene aperto con Excel/LibreOffice.
  const safe = /^[=+\-@\t\r]/.test(value.trimStart()) ? "'" + value : value;
  return '"' + safe.replace(/"/g, '""') + '"';
}
function exportCsv(items: Item[]) {
  const lines = [
    ["Data", "Ruolo", "Età", "Priorità", "Idea"].map(csvCell).join(";"),
    ...items.map((item) => [
      new Date(item.created_at).toLocaleString("it-IT"),
      roleLabel(item.role), ageLabel(item.age),
      item.interests.map(activityLabel).join(" | "), item.idea || "",
    ].map(csvCell).join(";")),
  ];
  const csv = "\uFEFF" + lines.join("\r\n");
  const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = href; a.download = "insieme-oltre-partecipazioni.csv";
  a.click(); URL.revokeObjectURL(href);
}

export default function PartecipazioniAdmin() {
  const [data, setData] = useState<Result | null>(null);
  const [message, setMessage] = useState("Caricamento risposte...");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      let token = "";
      try {
        const session = JSON.parse(localStorage.getItem("insieme_oltre_admin_session") || "null");
        if (session && typeof session.access_token === "string") token = session.access_token;
      } catch { /* sessione non leggibile */ }
      if (!token) { if (active) setMessage("Accedi prima dall'area amministrativa."); return; }
      try {
        const res = await fetch("/api/admin/partecipazioni", { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
        const payload = await res.json();
        if (!active) return;
        if (!res.ok) { setMessage(payload.error || "Impossibile caricare le risposte."); return; }
        setData(payload);
        setMessage("");
      } catch { if (active) setMessage("Connessione non riuscita, riprova."); }
    }
    load();
    return () => { active = false; };
  }, [refresh]);

  const counts = priorities.map((p) => ({
    ...p,
    value: data?.items.filter((item) => item.interests.includes(p.value)).length || 0,
  }));
  const top = Math.max(1, ...counts.map((x) => x.value));

  return <main className="admin-page">
    <section className="admin-shell">
      <div className="admin-heading"><p>Insieme Oltre · Area riservata</p><h1>Le idee delle famiglie</h1><span>Priorità e proposte per le attività</span></div>
      <div className="responses-nav"><Link href="/admin">← Torna al pannello</Link>
        <button onClick={() => setRefresh((n) => n + 1)}>Aggiorna</button>
        <button disabled={!data?.items.length} onClick={() => data && exportCsv(data.items)}>Esporta CSV</button>
      </div>
      {!data ? <div className="admin-card"><p role="status">{message}</p><Link href="/admin">Accedi o torna all'area riservata →</Link></div> :
      <>
        {message && <p role="status">{message}</p>}
        <div className="responses-metrics"><div><strong>{data.total}</strong><span>Risposte ricevute</span></div><div><strong>{data.items.length}</strong><span>Risposte visualizzate</span></div><div><strong>{data.items.filter((x) => x.idea).length}</strong><span>Proposte libere nel campione</span></div></div>
        {data.limited && <p className="responses-warning">Sono mostrate soltanto le 500 risposte più recenti. Le statistiche si riferiscono a questo campione.</p>}
        <section className="admin-card responses-chart" aria-label="Attività più richieste">
          <h2>Le attività più richieste</h2>
          <p>Una persona può scegliere fino a tre attività: le somme possono superare il numero delle risposte.</p>
          {counts.map((item) => <div className="responses-bar" key={item.value}>
            <div><strong>{item.title}</strong><span>{item.value}</span></div>
            <progress max={top} value={item.value} aria-label={item.title + ": " + item.value + " preferenze"} />
          </div>)}
        </section>
        <section className="admin-card responses-table">
          <h2>Risposte e suggerimenti</h2>
          <p>Le risposte non includono nomi, email o recapiti.</p>
          <div className="responses-scroller"><table>
            <thead><tr><th>Data</th><th>Partecipa come</th><th>Età</th><th>Attività</th><th>Suggerimento</th></tr></thead>
            <tbody>{data.items.map((item) => <tr key={item.id}>
              <td>{new Date(item.created_at).toLocaleDateString("it-IT")}</td>
              <td>{roleLabel(item.role)}</td><td>{ageLabel(item.age)}</td>
              <td>{item.interests.map(activityLabel).join(", ")}</td><td>{item.idea || "—"}</td>
            </tr>)}</tbody>
          </table></div>
          {data.items.length === 0 && <p>Non sono ancora arrivate risposte.</p>}
        </section>
      </>}
    </section>
  </main>;
}
