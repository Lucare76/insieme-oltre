"use client";
import { useCallback, useEffect, useState } from "react";
import type { Movement } from "../../lib/accounting";
import { receiptTitle, type Receipt } from "../../lib/receipts";
import MembershipReceiptForm from "./MembershipReceiptForm";
type Api = (path: string, init?: RequestInit) => Promise<Response>;
type ArchivedReceipt = Receipt & {
  resend_count?:number;
  resend_last_status?: "sending"|"sent"|"failed"|"unknown"|null;
  resend_last_at?:string|null;
};
const resendBlocked = (receipt:ArchivedReceipt) =>
  receipt.resend_last_status === "sending" || receipt.resend_last_status === "unknown" ||
  Boolean(receipt.resend_last_at && Date.now() - Date.parse(receipt.resend_last_at) < 15*60*1000);
const resendLabel = (status:string|null|undefined) =>
  status==="sent" ? "Accettato da Brevo"
  : status==="failed" ? "Rifiutato da Brevo"
  : "Da verificare";
const money = (n: number) =>
  (n / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const labels = {
  pending: "Da inviare",
  sending: "Invio in corso / da verificare",
  sent: "Accettata da Brevo",
  unknown: "Esito da verificare su Brevo",
};
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export default function ReceiptsPanel({ api }: { api: Api }) {
  const [items, setItems] = useState<ArchivedReceipt[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [configured, setConfigured] = useState(false);
  const [mailReady, setMailReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState("donation");
  const [source, setSource] = useState("new");
  const [payment, setPayment] = useState("bank_transfer");
  const [email, setEmail] = useState("");
  const [previewed, setPreviewed] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [sending, setSending] = useState<Receipt | null>(null);
  const [resending, setResending] = useState<ArchivedReceipt | null>(null);
  const [cancelling, setCancelling] = useState<Receipt | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const fetchData = useCallback(async () => {
    const [r, m] = await Promise.all([
      api("ricevute").then((r) => r.json()),
      api("movements").then((r) => r.json()),
    ]);
    return { r, m };
  }, [api]);
  const applyData = useCallback(
    ({
      r,
      m,
    }: {
      r: { items: ArchivedReceipt[]; configured: boolean; mail_ready: boolean };
      m: { items: Movement[] };
    }) => {
      setItems(r.items);
      setConfigured(r.configured);
      setMailReady(r.mail_ready);
      setMovements(m.items);
      setHasMore(r.items.length === 50);
      setLoaded(true);
    },
    [],
  );
  const load = useCallback(
    async () => applyData(await fetchData()),
    [applyData, fetchData],
  );
  useEffect(() => {
    let active = true;
    void fetchData()
      .then((data) => {
        if (active) applyData(data);
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [fetchData, applyData]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }
  const post = (data: Record<string, unknown>) =>
    api("ricevute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
  }).format(new Date());
  const incomes = movements.filter(
    (m) =>
      m.kind === "income" &&
      !m.cancelled &&
      m.category !== "Quote associative" &&
      m.date <= today &&
      !items.some((r) => r.movement_id === m.id && !r.cancelled),
  );
  return (
    <section className="soci-card" aria-label="Ricevute">
      <div className="soci-toolbar">
        <div>
          <p className="soci-kicker">DONAZIONI, RACCOLTE FONDI E QUOTE ASSOCIATIVE</p>
          <h2>Ricevute</h2>
          <p>
            Scegli il tipo di ricevuta. Per le quote associative puoi registrare il pagamento o scaricare nuovamente la ricevuta già emessa, senza duplicare l’incasso.
          </p>
        </div>
        <button disabled={busy} onClick={() => void run(load)}>
          Aggiorna
        </button>
        <button
          className="primary"
          disabled={busy || !loaded || !configured}
          onClick={() => {
            setEditing(true);
            setType("donation");
            setRequestId(crypto.randomUUID());
            setPreviewed(false);
            setEmail("");
            setSource("new");
            setPayment("bank_transfer");
          }}
        >
          + Nuova ricevuta
        </button>
      </div>
      <p>
        Le donazioni libere sono distinte dalle raccolte fondi con consegna di
        beni, come i panettoni. Le ricevute non attestano automaticamente
        agevolazioni fiscali.
      </p>
      {message && (
        <p className="soci-message" role="status">
          {message}
        </p>
      )}
      {loaded && !configured && (
        <p className="soci-message">
          Prima dell’emissione occorre configurare denominazione, codice
          fiscale, sede e rappresentante dell’associazione.
        </p>
      )}
      {loaded && !mailReady && (
        <p className="soci-message">
          Invio email non configurato. I PDF possono essere emessi e scaricati.
        </p>
      )}
      {loaded &&
        movements.filter((m) => m.kind === "income" && !m.cancelled).length ===
          0 && (
          <p className="accounting-empty">
            Non ci sono ancora incassi. Puoi preparare la prima ricevuta:
            l’entrata in Contabilità verrà registrata automaticamente solo
            quando la emetti. L’anteprima non registra movimenti.
          </p>
        )}
      {editing && (
        <div className="receipt-form">
          <label>
            Tipo di documento da emettere
            <select
              aria-label="Tipo di ricevuta"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPreviewed(false);
              }}
            >
              <option value="donation">Donazione libera, senza beni o servizi in cambio</option>
              <option value="fundraising">Raccolta fondi con consegna di beni</option>
              <option value="membership">Quota associativa</option>
            </select>
          </label>
        </div>
      )}
      {editing && type === "membership" && (
        <MembershipReceiptForm api={api} onClose={() => setEditing(false)} />
      )}
      {editing && type !== "membership" && (
        <form
          className="receipt-form"
          onChange={() => setPreviewed(false)}
          onSubmit={(e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.currentTarget));
            const movement = movements.find((m) => m.id === data.movement_id);
            const action =
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ??
              "preview";
            void run(async () => {
              if (action !== "preview" && !previewed)
                throw new Error("Scarica prima l’anteprima aggiornata.");
              const sendImmediately = action === "issue_send";
              const recipient = email.trim().toLowerCase();
              if (sendImmediately && (!mailReady || !recipient))
                throw new Error(
                  "Inserisci l’email del versante e verifica che l’invio sia configurato.",
                );
              const res = await post({
                ...data,
                type,
                source,
                action: action === "preview" ? "preview" : "issue",
                id: requestId,
                version: movement?.version,
                confirmed: data.confirmed === "on",
              });
              if (action === "preview") {
                download(await res.blob(), "anteprima-ricevuta.pdf");
                setPreviewed(true);
              } else {
                const result = await res.json();
                setEditing(false);
                setRequestId("");
                if (sendImmediately) {
                  try {
                    await post({
                      action: "send",
                      id: result.id,
                      confirm_email: recipient,
                    });
                  } catch (error) {
                    await load().catch(() => undefined);
                    throw new Error(
                      `Ricevuta n. ${result.number} emessa e salvata. ${error instanceof Error ? error.message : "Invio email non riuscito."}`,
                    );
                  }
                }
                let refreshed = true;
                await load().catch(() => {
                  refreshed = false;
                });
                setMessage(
                  (sendImmediately
                    ? `Ricevuta n. ${result.number} emessa. Email con PDF accettata da Brevo per ${recipient}.`
                    : `Ricevuta n. ${result.number} emessa. Puoi scaricarla e scegliere se inviarla.`) +
                    (refreshed
                      ? ""
                      : " Premi Aggiorna per ricaricare l’archivio."),
                );
              }
            });
          }}
        >
          <h3>Nuova ricevuta</h3>
          <label>
            Gestione dell’incasso
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="new">
                Registra automaticamente un nuovo incasso
              </option>
              <option value="existing" disabled={!incomes.length}>
                Collega un’entrata già registrata
              </option>
            </select>
          </label>
          {source === "new" ? (
            <>
              <label>
                Importo ricevuto (€)
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  maxLength={11}
                  placeholder="Es. 20,00"
                />
              </label>
              <label>
                Data dell’incasso
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={today}
                  max={today}
                />
              </label>
              <label>
                Progetto o iniziativa (facoltativo)
                <input name="project" maxLength={120} />
              </label>
              <p>
                L’entrata sarà registrata in{" "}
                {payment === "cash" ? "Cassa" : "Banca"}, nella categoria{" "}
                {type === "donation" ? "Donazioni" : "Raccolta fondi"}.
                Compilazione e anteprima non registrano incassi: l’entrata viene
                creata all’emissione della ricevuta.
              </p>
            </>
          ) : (
            <label>
              Incasso registrato
              <select name="movement_id" required defaultValue="">
                <option value="" disabled>
                  Seleziona l’entrata
                </option>
                {incomes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.date.split("-").reverse().join("/")} ·{" "}
                    {money(m.amount_cents)} · {m.description}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Nome e cognome / ragione sociale
            <input name="name" required maxLength={120} />
          </label>
          <label>
            Codice fiscale / partita IVA (facoltativo)
            <input name="tax_code" minLength={11} maxLength={16} />
          </label>
          <label>
            Indirizzo completo (facoltativo)
            <input name="address" maxLength={240} />
          </label>
          <label>
            Email del versante (obbligatoria)
            <input
              name="email"
              required
              type="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Metodo di pagamento
            <select
              name="payment"
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            >
              <option value="bank_transfer">Bonifico bancario</option>
              <option value="cash">Contanti</option>
              <option value="card">Carta</option>
            </select>
          </label>
          <label>
            Riferimento pagamento (obbligatorio per bonifico o carta)
            <input name="reference" maxLength={120} />
          </label>
          <label>
            {type === "donation"
              ? "Causale della donazione"
              : "Iniziativa, quantità e descrizione dei beni consegnati"}
            <textarea name="description" required maxLength={400} />
          </label>
          <label className="soci-check">
            <input type="checkbox" name="confirmed" required />
            Confermo l’incasso effettivo, la correttezza dei dati e{" "}
            {type === "donation"
              ? "l’assenza di beni o servizi in cambio della donazione."
              : "la classificazione dell’operazione come raccolta fondi, verificata dall’associazione."}
          </label>
          <p>
            La ricevuta emessa conserva i dati originali. Per correggerli
            occorre annullarla e riemetterla. La numerazione progressiva viene
            assegnata solo all’emissione.
          </p>
          <div className="soci-actions">
            <button disabled={busy} type="submit" value="preview">
              Scarica anteprima PDF
            </button>
            <button disabled={busy || !previewed} type="submit" value="issue">
              Emetti ricevuta
            </button>
            <button
              className="primary"
              disabled={busy || !previewed || !mailReady || !email.trim()}
              type="submit"
              value="issue_send"
            >
              Emetti e invia via email
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Chiudi
            </button>
          </div>
          {email.trim() && (
            <p>
              Con “Emetti e invia via email”, il PDF sarà inviato a{" "}
              <strong>{email.trim().toLowerCase()}</strong>. La consegna
              effettiva si verifica nei log Brevo.
            </p>
          )}
        </form>
      )}
      {sending && (
        <form
          className="receipt-form"
          onSubmit={(e) => {
            e.preventDefault();
            const email = new FormData(e.currentTarget).get("confirm_email");
            void run(async () => {
              await post({
                action: "send",
                id: sending.id,
                confirm_email: email,
              });
              setSending(null);
              await load();
              setMessage(
                "Email con PDF accettata da Brevo. La consegna si verifica nei log del servizio.",
              );
            });
          }}
        >
          <h3>Invia la ricevuta n. {sending.number}</h3>
          <p>Il PDF verrà inviato a {sending.data.email}.</p>
          <label>
            Riscrivi l’indirizzo per confermare
            <input
              type="email"
              name="confirm_email"
              autoComplete="off"
              required
            />
          </label>
          <button className="primary" disabled={busy}>
            Conferma e invia email
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setSending(null)}
          >
            Chiudi
          </button>
        </form>
      )}
      {resending && (
        <form className="receipt-form" onSubmit={(event) => {
          event.preventDefault();
          const fields=new FormData(event.currentTarget);
          if(fields.get("confirm")!=="on")return;
          const confirmEmail=String(fields.get("confirm_email")||"").trim().toLowerCase();
          const reason=String(fields.get("reason")||"").trim();
          void run(async()=>{
            await api("ricevute/reinvio",{
              method:"POST",headers:{"Content-Type":"application/json"},
              body:JSON.stringify({
                source:"general",id:resending.id,confirm_email:confirmEmail,reason,confirm:true,
              }),
            });
            setResending(null);
            const refreshed=await load().then(()=>true).catch(()=>false);
            setMessage("Reinvio accettato da Brevo per "+confirmEmail+
              ". Il documento e l’incasso originali non sono stati modificati."+
              (refreshed?"":" Aggiorna l'archivio per vedere il tentativo."));
          });
        }}>
          <h3>Reinvia ricevuta n. {resending.number}</h3>
          <p>Reinvierai <strong>la ricevuta già emessa</strong> a
            {" "}<strong>{resending.data.email}</strong>, senza creare nuovi movimenti o documenti.</p>
          <label>Conferma l'email del destinatario
            <input name="confirm_email" type="email" autoComplete="off" required placeholder="Riscrivi l'email originale"/>
          </label>
          <label>Motivo del reinvio
            <input name="reason" required minLength={5} maxLength={240} defaultValue="Richiesta del destinatario"/>
          </label>
          <label className="soci-check">
            <input name="confirm" type="checkbox" required/>
            Confermo la richiesta e che il destinatario è quello corretto.
          </label>
          <p>Ogni tentativo è tracciato. In caso di esito incerto verifica su Brevo prima di riprovare. Il sistema blocca reinvii troppo ravvicinati.</p>
          <div className="soci-actions">
            <button type="submit" className="primary" disabled={busy}>Conferma reinvio</button>
            <button type="button" disabled={busy} onClick={()=>setResending(null)}>Chiudi</button>
          </div>
        </form>
      )}
      {cancelling && (
        <form
          className="receipt-form"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = new FormData(e.currentTarget).get("reason");
            void run(async () => {
              await post({ action: "cancel", id: cancelling.id, reason });
              setCancelling(null);
              await load();
              setMessage(
                "Ricevuta annullata. L’incasso contabile resta invariato. Se la ricevuta era stata inviata, informa il destinatario dell’annullamento.",
              );
            });
          }}
        >
          <h3>Annulla la ricevuta n. {cancelling.number}</h3>
          <label>
            Motivazione
            <textarea name="reason" required minLength={10} maxLength={500} />
          </label>
          <p>
            Il documento resta nello storico. L’incasso non viene annullato.
          </p>
          <button disabled={busy}>Conferma annullamento</button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setCancelling(null)}
          >
            Chiudi
          </button>
        </form>
      )}
      {!loaded ? (
        <p>Caricamento ricevute…</p>
      ) : !items.length ? (
        <p className="accounting-empty">Nessuna ricevuta emessa.</p>
      ) : (
        <div className="soci-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Numero / data</th>
                <th>Versante</th>
                <th>Documento</th>
                <th>Importo</th>
                <th>Email</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.number}/{r.issued_on.slice(0, 4)}
                    <br />
                    {r.issued_on.split("-").reverse().join("/")}
                    {r.cancelled && <strong> · Annullata</strong>}
                  </td>
                  <td>{r.data.name}</td>
                  <td>{receiptTitle(r.data.type)}</td>
                  <td>{money(r.amount_cents)}</td>
                  <td>
                    {labels[r.mail_status]}
                    {r.sent_at && (
                      <>
                        <br />
                        {new Date(r.sent_at).toLocaleString("it-IT", {
                          timeZone: "Europe/Rome",
                        })}
                      </>
                    )}
                    {!!r.resend_count && (
                      <small style={{display:"block",marginTop:5}}>
                        Reinvii: {r.resend_count} · Ultimo: {resendLabel(r.resend_last_status)}
                        {r.resend_last_at ? " · "+new Date(r.resend_last_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"}) : ""}
                      </small>
                    )}
                  </td>
                  <td>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () =>
                          download(
                            await (await api(`ricevute?id=${r.id}`)).blob(),
                            `ricevuta-${r.number}${r.cancelled ? "-annullata" : ""}.pdf`,
                          ),
                        )
                      }
                    >
                      PDF
                    </button>
                    {!r.cancelled &&
                      r.data.email &&
                      r.mail_status === "pending" && (
                        <button
                          disabled={busy || !mailReady}
                          onClick={() => {
                            setSending(r);
                            setResending(null);
                            setCancelling(null);
                          }}
                        >
                          Invia email
                        </button>
                      )}
                    {!r.cancelled && r.mail_status !== "sending" && (
                      <button
                        disabled={busy}
                        onClick={() => {
                          setCancelling(r);
                          setSending(null);
                          setResending(null);
                        }}
                      >
                        Annulla
                      </button>
                    )}
                    {!r.cancelled && r.mail_status === "sent" && r.data.email && (
                      <button type="button" disabled={busy || !mailReady || resendBlocked(r)}
                        title={resendBlocked(r)?"Reinvio bloccato: verifica l'esito o attendi 15 minuti":undefined}
                        onClick={()=>{
                          setResending(r);setSending(null);setCancelling(null);
                        }}>
                        Reinvia ricevuta
                      </button>
                    )}
                    {r.cancelled && <span>{r.cancellation_reason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasMore && (
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const result = await (
                await api(`ricevute?offset=${items.length}`)
              ).json();
              setItems((previous) => [...previous, ...result.items]);
              setHasMore(result.items.length === 50);
            })
          }
        >
          Carica ricevute precedenti
        </button>
      )}
    </section>
  );
}
