"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Api = (path: string, init?: RequestInit) => Promise<Response>;
type Person = { id: string; full_name: string; admitted_on: string; ended_on: string | null; paid: boolean };
type Fee = { id: string; person_id: string; full_name: string; fee_year: number; amount_cents: number; paid_on: string; payment_account: "cash" | "bank" };
type FeesData = { year: number; people: Person[]; fees: Fee[]; count: number; total_cents: number };

const base = "libri-sociali/quote";
const formatMoney = (cents: number) => (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const localToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/**
 * La quota associativa resta distinta dalle liberalità.
 * Si usa la stessa API/RPC atomica del Libro soci: una quota = un incasso;
 * per le quote esistenti viene riscaricato il PDF senza una nuova entrata.
 */
export default function MembershipReceiptForm({ api, onClose }: { api: Api; onClose: () => void }) {
  const [year, setYear] = useState(() => Number(localToday().slice(0, 4)));
  const [data, setData] = useState<FeesData | null>(null);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [personId, setPersonId] = useState("");
  const [feeId, setFeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(localToday);
  const [account, setAccount] = useState<"bank" | "cash">("bank");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [restricted, setRestricted] = useState(false);
  const load = useCallback(async () => {
    const response = await api(base + "?year=" + year);
    const result = (await response.json()) as FeesData;
    setData(result);
    setPersonId("");
    setFeeId("");
    return result;
  }, [api, year]);
  useEffect(() => {
    let active = true;
    void load().then(() => { if (active) { setMessage(""); setRestricted(false); } }).catch((error) => {
      if (!active) return;
      const e = error as Error & { status?: number };
      setData(null);
      setRestricted(e.status === 403);
      setMessage(e.status === 403
        ? "La gestione delle quote richiede il ruolo Admin principale o Presidente. Le ricevute di donazione e raccolta fondi restano separate."
        : e.message || "Impossibile caricare le quote associative.");
    });
    return () => { active = false; };
  }, [load]);

  async function receipt(id: string) {
    const response = await api(base + "?receipt=" + encodeURIComponent(id));
    download(await response.blob(), "ricevuta-quota-associativa-" + year + "-" + id.slice(0, 8) + ".pdf");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    if (mode === "existing") {
      try {
        if (!feeId) throw new Error("Seleziona un pagamento già registrato.");
        await receipt(feeId);
        setMessage("Ricevuta PDF scaricata. Non è stato creato un nuovo incasso.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Ricevuta non disponibile.");
      } finally { setBusy(false); }
      return;
    }

    let savedId: string | null = null;
    try {
      if (!personId || !confirmed) throw new Error("Seleziona il socio e conferma l'incasso.");
      const result = await api(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: personId, year, amount, paid_on: paidOn, account, confirm: true }),
      });
      const payload = (await result.json()) as { id: string };
      if (!payload.id) throw new Error("Pagamento salvato ma identificativo non disponibile: verifica lo storico.");
      savedId = payload.id;
      // Dopo la registrazione non ripetere mai il POST se il download PDF fallisce.
      setMode("existing");
      setConfirmed(false);
      await load().catch(() => undefined);
      setFeeId(savedId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registrazione non riuscita.");
      setBusy(false);
      return;
    }
    try {
      await receipt(savedId);
      setMessage("Quota registrata in Contabilità e ricevuta PDF scaricata. Nessun doppio incasso.");
    } catch (error) {
      setMessage("Quota registrata in Contabilità. Il download PDF non è riuscito: seleziona il versamento esistente e riscarica la ricevuta, senza registrare una nuova quota. " + (error instanceof Error ? error.message : ""));
    } finally {
      setBusy(false);
    }
  }

  const eligible = (data?.people ?? []).filter(p => !p.paid && (!p.ended_on || p.ended_on >= paidOn));
  return (
    <form className="receipt-form" onSubmit={(e) => void submit(e)}>
      <h3>Ricevuta quota associativa</h3>
      <p>Questa ricevuta è distinta dalle donazioni. Puoi registrare il pagamento e scaricarla, oppure ristampare quella di una quota già incassata. Ogni registrazione genera una sola entrata in Contabilità.</p>
      <label>Anno associativo
        <select value={year} onChange={e => { setYear(Number(e.target.value)); setConfirmed(false); }}>
          {Array.from({ length: 6 }, (_, i) => Number(localToday().slice(0, 4)) + 1 - i).map(y => <option value={y} key={y}>{y}</option>)}
        </select>
      </label>
      <label>Operazione
        <select value={mode} onChange={e => { setMode(e.target.value as "new" | "existing"); setConfirmed(false); }}>
          <option value="new">Registra quota versata ed emetti ricevuta</option>
          <option value="existing">Scarica ricevuta di una quota già registrata</option>
        </select>
      </label>
      {restricted && <p role="status" className="soci-message">{message}</p>}
      {data && mode === "new" && (
        <>
          <label>Socio iscritto nel Libro soci
            <select required value={personId} onChange={e => { setPersonId(e.target.value); setConfirmed(false); }}>
              <option value="">Seleziona il socio</option>
              {eligible.map(person => <option value={person.id} key={person.id}>{person.full_name}</option>)}
            </select>
          </label>
          {!eligible.length && <p className="soci-message">Nessun socio disponibile per questo anno. Inserisci prima i soci nel <Link href="/admin/libri-sociali">Libro soci</Link> e verifica se la quota è già registrata.</p>}
          <label>Importo versato (€)
            <input type="text" inputMode="decimal" maxLength={11} placeholder="Es. 20,00" required value={amount} onChange={e => setAmount(e.target.value)} />
          </label>
          <label>Data effettiva del pagamento
            <input type="date" required max={localToday()} value={paidOn} onChange={e => setPaidOn(e.target.value)} />
          </label>
          <label>Incassato su
            <select value={account} onChange={e => setAccount(e.target.value as "bank" | "cash")}>
              <option value="bank">Conto bancario</option>
              <option value="cash">Cassa contanti</option>
            </select>
          </label>
          <label className="soci-check">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required />
            Confermo che questa quota è stata effettivamente incassata e non è già presente in Contabilità.
          </label>
          <p><small>Per un pagamento già presente in Contabilità, verifica prima la registrazione: questa funzione non importa automaticamente vecchi incassi.</small></p>
          <button type="submit" className="primary" disabled={busy || !personId || !amount || !confirmed}>Registra quota e scarica ricevuta</button>
        </>
      )}
      {data && mode === "existing" && (
        <>
          <label>Versamento già registrato
            <select required value={feeId} onChange={e => setFeeId(e.target.value)}>
              <option value="">Seleziona il pagamento</option>
              {data.fees.map(fee =>
                <option key={fee.id} value={fee.id}>{fee.full_name} · {fee.paid_on.split("-").reverse().join("/")} · {formatMoney(fee.amount_cents)}</option>,
              )}
            </select>
          </label>
          {!data.fees.length && <p>Nessuna quota associativa risulta registrata per l'anno scelto.</p>}
          <button type="submit" disabled={busy || !feeId}>Scarica ricevuta PDF</button>
        </>
      )}
      {message && !restricted && <p role="status" className="soci-message">{message}</p>}
      <button type="button" disabled={busy} onClick={onClose}>Chiudi</button>
    </form>
  );
}
