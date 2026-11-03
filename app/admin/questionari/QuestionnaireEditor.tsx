"use client";
import { useEffect, useState } from "react";
import {
  draftProblem,
  kindLabels,
  retentionChoices,
  type DraftQuestion,
  type QsQuestion,
  type QuestionKind,
  type Questionnaire,
} from "../../../lib/questionnaires";
import { QuestionnaireForm } from "../../q/[token]/QuestionnaireForm";
import type { QsApi } from "./useQsApi";
import type { View } from "./page";
import "../../partecipa/partecipa.css";
import "../../q/[token]/q.css";

type EditQuestion = DraftQuestion & { key: string };
const blank = (kind: QuestionKind): EditQuestion => ({
  key: crypto.randomUUID(),
  kind,
  prompt: "",
  help: "",
  required: true,
  options: kind === "text" ? [] : ["", ""],
});
function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

export function QuestionnaireEditor({ api, id, go }: { api: QsApi; id?: string; go: (view: View) => void }) {
  const [loaded, setLoaded] = useState(!id);
  const [base, setBase] = useState<Questionnaire | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetingRef, setMeetingRef] = useState("");
  const [retention, setRetention] = useState("");
  const [questions, setQuestions] = useState<EditQuestion[]>([]);
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = Boolean(base && base.status !== "draft");

  useEffect(() => {
    if (!id) return;
    let active = true;
    api("questionnaire?id=" + id)
      .then((r) => r.json())
      .then((data: { questionnaire: Questionnaire; questions: QsQuestion[] }) => {
        if (!active) return;
        const q = data.questionnaire;
        setBase(q);
        setTitle(q.title);
        setDescription(q.description);
        setMeetingRef(q.meeting_ref);
        setRetention(q.retention_months ? String(q.retention_months) : "");
        setQuestions(
          data.questions.map((x) => ({ key: x.id, kind: x.kind, prompt: x.prompt, help: x.help, required: x.required, options: x.options.map((o) => o.label) })),
        );
        setLoaded(true);
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [api, id]);
  // Evita di perdere le modifiche chiudendo la scheda per errore.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setDirty(true);
      setError("");
    };
  }
  const setQ = change(setQuestions);
  const patch = (index: number, value: Partial<EditQuestion>) =>
    setQ(questions.map((q, n) => (n === index ? { ...q, ...value } : q)));
  const draft = () => ({
    title: title.trim(),
    description,
    meeting_ref: meetingRef.trim(),
    retention_months: retention ? Number(retention) : null,
    ...(locked ? {} : { questions: questions.map(({ kind, prompt, help, required, options }) => ({ kind, prompt: prompt.trim(), help: help.trim(), required, options: options.map((o) => o.trim()) })) }),
  });
  async function save(publish = false) {
    const value = draft();
    const problem = draftProblem(value) ?? (publish && !questions.length ? "Aggiungi almeno una domanda prima di pubblicare." : null);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      const saved: Questionnaire = (
        await (
          await api("save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...value, id: base?.id, version: base?.version }),
          })
        ).json()
      ).questionnaire;
      if (publish)
        await api("status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: saved.id, action: "publish" }),
        });
      setDirty(false);
      go({ kind: "detail", id: saved.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvataggio non riuscito.");
    } finally {
      setBusy(false);
    }
  }
  function leave() {
    if (dirty && !window.confirm("Ci sono modifiche non salvate. Uscire comunque?")) return;
    go(base ? { kind: "detail", id: base.id } : { kind: "list" });
  }

  if (!loaded) return <section className="soci-card">{error ? <p role="alert">{error}</p> : <p role="status">Caricamento…</p>}</section>;
  const previewQuestions: QsQuestion[] = questions.map((q) => ({
    id: q.key,
    kind: q.kind,
    prompt: q.prompt || "(domanda senza testo)",
    help: q.help,
    required: q.required,
    options: q.options.map((label, n) => ({ id: q.key + "-" + n, label: label || "(opzione vuota)" })),
  }));
  return (
    <section className="soci-card qs-editor">
      <div className="qs-toolbar">
        <button onClick={leave}>← Indietro</button>
        <h2>{base ? "Modifica questionario" : "Nuovo questionario"}</h2>
        <button aria-pressed={preview} onClick={() => setPreview(!preview)}>
          {preview ? "Torna all’editor" : "Anteprima"}
        </button>
      </div>
      {preview ? (
        <div className="qs-preview">
          <p className="soci-kicker">Anteprima: così vedranno il questionario i partecipanti</p>
          <h3 className="qs-preview-title">{title || "(senza titolo)"}</h3>
          {description && <p className="qs-pre">{description}</p>}
          <div className="participa-page qs-preview-form">
            <QuestionnaireForm questions={previewQuestions} retentionMonths={retention ? Number(retention) : null} />
          </div>
        </div>
      ) : (
        <>
          <div className="soci-grid">
            <label className="wide">
              Titolo *
              <input value={title} maxLength={200} onChange={(e) => change(setTitle)(e.target.value)} placeholder="Es. Emozioni dei genitori" />
            </label>
            <label className="wide">
              Descrizione (facoltativa)
              <textarea value={description} rows={3} onChange={(e) => change(setDescription)(e.target.value)} placeholder="Una breve introduzione per i partecipanti" />
            </label>
            <label>
              Incontro di riferimento
              <input value={meetingRef} maxLength={200} onChange={(e) => change(setMeetingRef)(e.target.value)} placeholder="Es. Incontro genitori — 2 novembre" />
            </label>
            <label>
              Conservazione delle risposte
              <select value={retention} onChange={(e) => change(setRetention)(e.target.value)}>
                {retentionChoices.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <h3>Domande ({questions.length})</h3>
          {locked && (
            <p className="qs-notice-box">
              Le domande di un questionario pubblicato non si modificano, per non alterare le risposte già raccolte. Puoi
              aggiornare titolo, descrizione e conservazione. Per cambiare le domande usa «Duplica» e pubblica la nuova versione.
            </p>
          )}
          <ol className="qs-questions">
            {questions.map((q, n) => (
              <li key={q.key} className="qs-question">
                <div className="qs-question-head">
                  <strong>Domanda {n + 1}</strong>
                  {!locked && (
                    <div className="soci-actions">
                      <button type="button" aria-label={`Sposta su la domanda ${n + 1}`} disabled={n === 0} onClick={() => setQ(move(questions, n, n - 1))}>
                        ↑
                      </button>
                      <button type="button" aria-label={`Sposta giù la domanda ${n + 1}`} disabled={n === questions.length - 1} onClick={() => setQ(move(questions, n, n + 1))}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className="qs-danger"
                        onClick={() => window.confirm(`Eliminare la domanda ${n + 1}?`) && setQ(questions.filter((_, i) => i !== n))}
                      >
                        Elimina
                      </button>
                    </div>
                  )}
                </div>
                <div className="soci-grid">
                  <label className="wide">
                    Testo della domanda
                    <textarea value={q.prompt} rows={2} disabled={locked} onChange={(e) => patch(n, { prompt: e.target.value })} />
                  </label>
                  <label>
                    Tipo di risposta
                    <select
                      value={q.kind}
                      disabled={locked}
                      onChange={(e) => {
                        const kind = e.target.value as QuestionKind;
                        patch(n, { kind, options: kind === "text" ? [] : q.options.length >= 2 ? q.options : ["", ""] });
                      }}
                    >
                      {(Object.keys(kindLabels) as QuestionKind[]).map((k) => (
                        <option key={k} value={k}>
                          {kindLabels[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="soci-check qs-required-check">
                    <input type="checkbox" checked={q.required} disabled={locked} onChange={(e) => patch(n, { required: e.target.checked })} />
                    Risposta obbligatoria
                  </label>
                  <label className="wide">
                    Indicazione per chi risponde (facoltativa)
                    <input value={q.help} disabled={locked} onChange={(e) => patch(n, { help: e.target.value })} />
                  </label>
                </div>
                {q.kind === "text" ? (
                  <p className="qs-muted">Il partecipante potrà scrivere liberamente, senza limite di lunghezza.</p>
                ) : (
                  <div className="qs-options">
                    <p className="qs-muted">{q.kind === "single" ? "Si potrà scegliere una sola opzione." : "Si potranno scegliere più opzioni."}</p>
                    {q.options.map((o, i) => (
                      <div key={i} className="qs-option">
                        <input
                          aria-label={`Opzione ${i + 1} della domanda ${n + 1}`}
                          value={o}
                          disabled={locked}
                          placeholder={`Opzione ${i + 1}`}
                          onChange={(e) => patch(n, { options: q.options.map((x, j) => (j === i ? e.target.value : x)) })}
                        />
                        {!locked && (
                          <>
                            <button type="button" aria-label="Sposta su" disabled={i === 0} onClick={() => patch(n, { options: move(q.options, i, i - 1) })}>
                              ↑
                            </button>
                            <button type="button" aria-label="Sposta giù" disabled={i === q.options.length - 1} onClick={() => patch(n, { options: move(q.options, i, i + 1) })}>
                              ↓
                            </button>
                            <button type="button" aria-label="Rimuovi opzione" disabled={q.options.length <= 2} onClick={() => patch(n, { options: q.options.filter((_, j) => j !== i) })}>
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                    {!locked && (
                      <button type="button" onClick={() => patch(n, { options: [...q.options, ""] })}>
                        + Aggiungi opzione
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
          {!locked && (
            <div className="qs-add">
              <span>Aggiungi una domanda:</span>
              {(Object.keys(kindLabels) as QuestionKind[]).map((k) => (
                <button key={k} type="button" onClick={() => setQ([...questions, blank(k)])}>
                  + {kindLabels[k]}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {error && (
        <p className="soci-message" role="alert">
          {error}
        </p>
      )}
      <div className="qs-savebar">
        <button className="primary" disabled={busy} onClick={() => void save()}>
          {busy ? "Salvataggio…" : base?.status === "draft" || !base ? "Salva bozza" : "Salva modifiche"}
        </button>
        {(!base || base.status === "draft") && (
          <button
            disabled={busy}
            onClick={() => window.confirm("Pubblicare il questionario? Verrà creato il link con QR code e le domande non saranno più modificabili.") && void save(true)}
          >
            Salva e pubblica
          </button>
        )}
      </div>
    </section>
  );
}
