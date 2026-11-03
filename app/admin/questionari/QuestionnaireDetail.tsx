"use client";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  kindLabels,
  qsDateTime,
  retentionText,
  statusLabels,
  type QsQuestion,
  type QsSession,
  type Questionnaire,
} from "../../../lib/questionnaires";
import type { QsApi } from "./useQsApi";
import type { View } from "./page";

type Data = { questionnaire: Questionnaire; questions: QsQuestion[]; sessions: QsSession[] };
const sessionUrl = (token: string) => `${window.location.origin}/q/${token}`;
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
const actions: Record<Questionnaire["status"], { action: string; label: string; confirm?: string }[]> = {
  draft: [
    { action: "publish", label: "Pubblica", confirm: "Pubblicare? Verrà creato il link con QR code e le domande non saranno più modificabili." },
    { action: "archive", label: "Archivia" },
  ],
  published: [
    { action: "close", label: "Chiudi questionario", confirm: "Chiudere il questionario? Tutte le sessioni smetteranno di accettare risposte." },
    { action: "archive", label: "Archivia", confirm: "Archiviare? Le sessioni aperte verranno chiuse. I risultati restano consultabili." },
  ],
  closed: [
    { action: "reopen", label: "Riapri questionario" },
    { action: "archive", label: "Archivia" },
  ],
  archived: [{ action: "restore", label: "Ripristina dall’archivio" }],
};

function QrPanel({ session, title }: { session: QsSession; title: string }) {
  const [svg, setSvg] = useState("");
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = sessionUrl(session.token);
  useEffect(() => {
    let active = true;
    // Generato nel browser: nessun servizio esterno riceve il link.
    QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#1f3326", light: "#ffffff" } }).then(
      (value) => active && setSvg(value),
    );
    return () => {
      active = false;
    };
  }, [url]);
  useEffect(() => {
    if (!full) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [full]);
  const name = `qr-${title}-${session.label}`.normalize("NFKD").replace(/[^\w-]+/g, "-").slice(0, 70);
  async function downloadPng() {
    const a = document.createElement("a");
    a.href = await QRCode.toDataURL(url, { width: 1200, margin: 3, errorCorrectionLevel: "M" });
    a.download = name + ".png";
    a.click();
  }
  function downloadSvg() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    a.download = name + ".svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const whatsapp = "https://wa.me/?text=" + encodeURIComponent(`${title} — ${session.label}\nCompila il questionario anonimo: ${url}`);
  return (
    <div className="qs-qr">
      {svg && <div className="qs-qr-image" role="img" aria-label="QR code del questionario" dangerouslySetInnerHTML={{ __html: svg }} />}
      <div className="qs-qr-side">
        <label>
          Link di partecipazione
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        </label>
        <div className="soci-actions">
          <button
            onClick={() =>
              void navigator.clipboard.writeText(url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              })
            }
          >
            {copied ? "Copiato ✓" : "Copia link"}
          </button>
          <button className="primary" onClick={() => setFull(true)}>
            Mostra a schermo intero
          </button>
          <button onClick={() => void downloadPng()}>Scarica PNG</button>
          <button onClick={downloadSvg}>Scarica SVG</button>
          <a className="qs-button" href={whatsapp} target="_blank" rel="noreferrer">
            Condividi su WhatsApp
          </a>
          <a className="qs-button" href={url} target="_blank" rel="noreferrer">
            Apri il questionario
          </a>
        </div>
      </div>
      {full && (
        <div className="qs-fullscreen" role="dialog" aria-modal="true" aria-label="QR code a schermo intero" onClick={() => setFull(false)}>
          <h2>{title}</h2>
          <p>Inquadra il codice con la fotocamera del telefono</p>
          <div className="qs-qr-image" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="qs-fullscreen-url">{url}</p>
          <button onClick={() => setFull(false)}>Chiudi (Esc)</button>
        </div>
      )}
    </div>
  );
}

export function QuestionnaireDetail({ api, id, go }: { api: QsApi; id: string; go: (view: View) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const value: Data = await (await api("questionnaire?id=" + id)).json();
    setData(value);
    return value;
  }, [api, id]);
  useEffect(() => {
    queueMicrotask(() =>
      load()
        .then((value) => setQr((current) => current ?? value.sessions.find((s) => s.status === "open")?.id ?? null))
        .catch((e) => setError(e.message)),
    );
  }, [load]);
  async function post(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      const result = await (
        await api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      ).json();
      await load();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <section className="soci-card">{error ? <p role="alert">{error}</p> : <p role="status">Caricamento…</p>}</section>;
  const { questionnaire: q, questions, sessions } = data;
  const total = sessions.reduce((sum, s) => sum + s.submission_count, 0);
  return (
    <>
      <section className="soci-card">
        <div className="qs-toolbar">
          <button onClick={() => go({ kind: "list" })}>← Tutti i questionari</button>
          <span className={"qs-badge qs-" + q.status}>{statusLabels[q.status]}</span>
        </div>
        <h2 className="qs-detail-title">{q.title}</h2>
        {q.meeting_ref && <p className="qs-muted">{q.meeting_ref}</p>}
        {q.description && <p className="qs-pre">{q.description}</p>}
        <p className="qs-muted">
          {questions.length} domande · {sessions.length} sessioni · {total} compilazioni · {retentionText(q.retention_months)}
        </p>
        {error && (
          <p className="soci-message" role="alert">
            {error}
          </p>
        )}
        <div className="soci-actions qs-status-actions">
          <button onClick={() => go({ kind: "edit", id: q.id })}>{q.status === "draft" ? "Modifica domande" : "Modifica dettagli"}</button>
          {actions[q.status].map((a) => (
            <button
              key={a.action}
              className={a.action === "publish" ? "primary" : undefined}
              disabled={busy}
              onClick={() => (!a.confirm || window.confirm(a.confirm)) && void post("status", { id: q.id, action: a.action }).then(() => load().then((v) => setQr(v.sessions.find((s) => s.status === "open")?.id ?? null)))}
            >
              {a.label}
            </button>
          ))}
          {(q.status === "published" || q.status === "closed") && total === 0 && (
            <button disabled={busy} onClick={() => window.confirm("Riportare in bozza per modificare le domande? Le sessioni verranno chiuse.") && void post("status", { id: q.id, action: "draft" })}>
              Torna in bozza
            </button>
          )}
          <button
            disabled={busy}
            onClick={() =>
              void post("duplicate", { id: q.id }).then((r) => r?.questionnaire && go({ kind: "edit", id: r.questionnaire.id }))
            }
          >
            Duplica
          </button>
          {q.status === "draft" && !sessions.length && (
            <button
              className="qs-danger"
              disabled={busy}
              onClick={() => window.confirm("Eliminare definitivamente questa bozza?") && void post("delete", { id: q.id }).then((r) => r?.ok && go({ kind: "list" }))}
            >
              Elimina bozza
            </button>
          )}
        </div>
      </section>
      {q.status !== "draft" && (
        <section className="soci-card" aria-labelledby="qs-sessions">
          <h2 id="qs-sessions">Sessioni e QR code</h2>
          <p>Ogni incontro ha il proprio link e il proprio QR code: i risultati delle sessioni restano separati.</p>
          {q.status === "published" && (
            <form
              className="qs-new-session"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const target = e.currentTarget;
                void post("session", { questionnaire_id: q.id, label: form.get("label"), meeting_date: form.get("meeting_date") }).then((r) => {
                  if (r?.session) {
                    target.reset();
                    setQr(r.session.id);
                  }
                });
              }}
            >
              <label>
                Nuova sessione
                <input name="label" required maxLength={200} placeholder="Es. Incontro del 16 novembre" />
              </label>
              <label>
                Data dell’incontro
                <input name="meeting_date" type="date" defaultValue={today()} />
              </label>
              <button className="primary" disabled={busy}>
                Crea sessione e QR
              </button>
            </form>
          )}
          <ul className="qs-sessions">
            {sessions.map((s) => (
              <li key={s.id}>
                <div className="qs-session-row">
                  <div>
                    <span className={"qs-badge " + (s.status === "open" ? "qs-open" : "qs-closed")}>{s.status === "open" ? "Aperta" : "Chiusa"}</span>
                    <strong>{s.label}</strong>
                    <small>
                      {s.meeting_date ? s.meeting_date.split("-").reverse().join("/") + " · " : ""}
                      {s.submission_count} compilazioni · creata il {qsDateTime(s.created_at)}
                    </small>
                  </div>
                  <div className="soci-actions">
                    <button aria-expanded={qr === s.id} onClick={() => setQr(qr === s.id ? null : s.id)}>
                      {qr === s.id ? "Nascondi QR" : "QR e link"}
                    </button>
                    <button className="primary" onClick={() => go({ kind: "results", session: s.id })}>
                      Risultati
                    </button>
                    {s.status === "open" ? (
                      <button disabled={busy} onClick={() => window.confirm(`Chiudere la sessione «${s.label}»? Non accetterà più risposte.`) && void post("session-status", { id: s.id, open: false })}>
                        Chiudi sessione
                      </button>
                    ) : (
                      q.status === "published" && (
                        <button disabled={busy} onClick={() => void post("session-status", { id: s.id, open: true })}>
                          Riapri sessione
                        </button>
                      )
                    )}
                  </div>
                </div>
                {qr === s.id && <QrPanel session={s} title={q.title} />}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="soci-card">
        <h2>Domande</h2>
        <ol className="qs-summary">
          {questions.map((x) => (
            <li key={x.id}>
              <strong className="qs-pre">{x.prompt}</strong>
              <small>
                {kindLabels[x.kind]} · {x.required ? "obbligatoria" : "facoltativa"}
                {x.options.length > 0 && " · " + x.options.map((o) => o.label).join(" / ")}
              </small>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
