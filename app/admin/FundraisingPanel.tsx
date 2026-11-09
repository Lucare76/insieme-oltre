"use client";
import { useMemo, useState } from "react";
import type { Movement } from "../../lib/accounting";

const presets = ["Natale Solidale 2026", "Pasqua Solidale 2027"];
const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
type Entry = Pick<Movement, "id" | "date" | "kind" | "amount_cents" | "description" | "category" | "project" | "cancelled">;

function sum(items: Entry[]) {
  return items.reduce((n, x) => n + x.amount_cents, 0);
}
export function calculateFundraising(items: Entry[], project: string) {
  const valid = items.filter(x => !x.cancelled && x.project.trim() === project && (x.kind === "income" || x.kind === "expense"));
  const incomes = valid.filter(x => x.kind === "income").sort((a, b) => a.date.localeCompare(b.date));
  const expenses = valid.filter(x => x.kind === "expense").sort((a, b) => a.date.localeCompare(b.date));
  return { incomes, expenses, income: sum(incomes), expense: sum(expenses), net: sum(incomes) - sum(expenses) };
}

function plain(s: string) {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, " ").trim();
}
function drawLines(text: string, width = 86) {
  const result: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of plain(paragraph).split(/\s+/)) {
      if ((line + " " + word).trim().length > width) {
        if (line) result.push(line);
        line = word;
      } else line = (line + " " + word).trim();
    }
    result.push(line);
  }
  return result;
}

export function FundraisingPanel({ items, loaded, onOpenAccounting }: {
  items: Movement[];
  loaded: boolean;
  onOpenAccounting: () => void;
}) {
  const events = useMemo(() => [...new Set([...presets, ...items.map(x => x.project).filter(x => /solidal|raccolta|natale|pasqua/i.test(x))])], [items]);
  const [selected, setSelected] = useState(presets[0]);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const report = useMemo(() => calculateFundraising(items, selected), [items, selected]);
  const rows = [...report.incomes.map(x => ({ ...x, sign: "+" })), ...report.expenses.map(x => ({ ...x, sign: "-" }))].sort((a, b) => a.date.localeCompare(b.date));
  const missing = !description.trim();

  async function downloadReport() {
    setSaving(true);
    setError("");
    try {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      let page = pdf.addPage([595, 842]);
      let y = 800;
      const left = 48;
      const print = (value: string, size = 10, emphasize = false) => {
        if (y < 58) { page = pdf.addPage([595, 842]); y = 800; }
        page.drawText(plain(value).slice(0, 105), { x: left, y, size, font: emphasize ? bold : font, color: rgb(0.12, 0.18, 0.22) });
        y -= size + 8;
      };
      print("INSIEME OLTRE ODV", 16, true);
      print("Rendiconto separato della raccolta fondi occasionale", 12, true);
      print(selected, 12, true);
      y -= 8;
      print("ENTRATE", 12, true);
      for (const x of report.incomes) {
        for (const line of drawLines(`${x.date} | ${x.category} | ${x.description} | ${euro(x.amount_cents)}`, 85)) print(line, 9);
      }
      print(`Totale entrate: ${euro(report.income)}`, 11, true);
      y -= 8;
      print("USCITE", 12, true);
      for (const x of report.expenses) {
        for (const line of drawLines(`${x.date} | ${x.category} | ${x.description} | ${euro(x.amount_cents)}`, 85)) print(line, 9);
      }
      print(`Totale uscite: ${euro(report.expense)}`, 11, true);
      print(`Risultato netto: ${euro(report.net)}`, 12, true);
      y -= 14;
      print("RELAZIONE ILLUSTRATIVA", 12, true);
      const narrative = description.trim() || "Da completare: finalita, periodo, luogo, modalita della raccolta e destinazione dei fondi.";
      for (const line of drawLines(narrative, 86)) print(line, 10);
      y -= 12;
      print("Bozza da verificare e approvare prima del deposito al RUNTS.", 9);
      print("Importi derivati dai movimenti contabili attivi collegati all'iniziativa.", 9);
      const bytes = await pdf.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rendiconto-${selected.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Non è stato possibile generare il PDF. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="soci-card" aria-label="Raccolte fondi occasionali">
    <p className="soci-kicker">TRASPARENZA E RENDICONTAZIONE</p>
    <h2>Raccolte fondi</h2>
    <p>Rendiconto per iniziativa, ricavato dai movimenti già registrati in Contabilità. Nessuna duplicazione degli incassi.</p>
    <div className="soci-grid">
      <label>Iniziativa
        <select value={selected} onChange={e => { setSelected(e.target.value); setDescription(""); }}>
          {events.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </label>
    </div>
    <p>Per attribuire un movimento a questa raccolta, inserisci esattamente <strong>{selected}</strong> nel campo «Iniziativa» della Contabilità.</p>
    <button type="button" onClick={onOpenAccounting}>Apri Contabilità</button>
    {!loaded ? <p role="status">Caricamento dei movimenti…</p> : <>
      <div className="accounting-period">
        <div><span>Entrate</span><strong>{euro(report.income)}</strong></div>
        <div><span>Uscite</span><strong>{euro(report.expense)}</strong></div>
        <div><span>Risultato netto</span><strong>{euro(report.net)}</strong></div>
      </div>
      <h3>Movimenti collegati ({rows.length})</h3>
      {rows.length === 0 ? <p>Nessun movimento associato a questa iniziativa. Il rendiconto sarà compilato automaticamente dopo le registrazioni.</p> :
        <div className="soci-table-wrap"><table><thead><tr><th>Data</th><th>Descrizione</th><th>Tipo</th><th>Importo</th></tr></thead><tbody>
          {rows.map(x => <tr key={x.id}><td>{x.date}</td><td>{x.description}</td><td>{x.sign === "+" ? "Entrata" : "Uscita"}</td><td>{x.sign} {euro(x.amount_cents)}</td></tr>)}
        </tbody></table></div>}
      <label style={{ display: "block", marginTop: 24 }}>Relazione illustrativa (da completare prima del deposito)
        <textarea rows={5} value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Indica finalità, periodo e luogo della raccolta, modalità di svolgimento, beni offerti e destinazione dei fondi." style={{ width: "100%" }} />
      </label>
      <p>La relazione non è salvata sul server: inseriscila e scarica il PDF nella stessa sessione. Il documento è una bozza da verificare rispetto al modello ministeriale prima del deposito.</p>
      {missing && <p>La relazione è ancora da compilare: il PDF la segnalerà come incompleta.</p>}
      {error && <p role="alert">{error}</p>}
      <button type="button" className="primary" disabled={saving || !rows.length} onClick={() => void downloadReport()}>
        {saving ? "Generazione PDF…" : "Scarica bozza rendiconto PDF"}
      </button>
    </>}
  </section>;
}
