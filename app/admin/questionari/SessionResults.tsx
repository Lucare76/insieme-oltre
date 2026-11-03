"use client";
import { useCallback, useEffect, useState } from "react";
import {
  anonymousLabel,
  answerText,
  kindLabels,
  qsDateTime,
  type QsQuestion,
  type QsSession,
  type QsSubmission,
  type Questionnaire,
} from "../../../lib/questionnaires";
import { downloadResponse, type QsApi } from "./useQsApi";
import type { View } from "./page";

type Base = { session: QsSession; questionnaire: Questionnaire; questions: QsQuestion[] };
type Stats = { total: number; questions: { id: string; answered: number; options: { id: string; count: number }[] }[] };
const PAGE = 25;
const percent = (n: number, of: number) => (of ? Math.round((n / of) * 1000) / 10 : 0).toLocaleString("it-IT") + "%";

function Answers({ questions, submission }: { questions: QsQuestion[]; submission: QsSubmission }) {
  return (
    <ol className="qs-answers">
      {questions.map((q) => {
        const answer = submission.qs_answers.find((a) => a.question_id === q.id);
        const text = answerText(q, answer);
        return (
          <li key={q.id}>
            <h4 className="qs-pre">{q.prompt}</h4>
            {!text ? (
              <p className="qs-muted">— Nessuna risposta</p>
            ) : q.kind === "text" ? (
              <p className="qs-pre qs-free">{text}</p>
            ) : (
              <ul className="qs-picked">
                {q.options
                  .filter((o) => answer?.option_ids?.includes(o.id))
                  .map((o) => (
                    <li key={o.id}>{o.label}</li>
                  ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function SessionResults({ api, sessionId, initialSeq, go }: { api: QsApi; sessionId: string; initialSeq?: number; go: (view: View) => void }) {
  const [tab, setTab] = useState<"cards" | "stats">("cards");
  const [base, setBase] = useState<Base | null>(null);
  const [page, setPage] = useState<{ items: QsSubmission[]; total: number; offset: number }>({ items: [], total: 0, offset: 0 });
  const [current, setCurrent] = useState<{ submission: QsSubmission; prev: number | null; next: number | null } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [texts, setTexts] = useState<Record<string, { seq: number; text: string }[]>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const query = "session=" + sessionId;

  const loadPage = useCallback(
    async (offset: number) => {
      const data = await (await api(`submissions?${query}&offset=${offset}`)).json();
      setBase({ session: data.session, questionnaire: data.questionnaire, questions: data.questions });
      setPage({ items: data.items, total: data.total, offset });
    },
    [api, query],
  );
  const open = useCallback(
    async (seq: number) => {
      setError("");
      try {
        const data = await (await api(`submission?${query}&seq=${seq}`)).json();
        setCurrent({ submission: data.submission, prev: data.prev, next: data.next });
        document.getElementById("qs-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Compilazione non disponibile.");
      }
    },
    [api, query],
  );
  const loadStats = useCallback(async () => {
    const data = await (await api(`stats?${query}`)).json();
    setBase({ session: data.session, questionnaire: data.questionnaire, questions: data.questions });
    setStats(data.stats);
  }, [api, query]);

  useEffect(() => {
    queueMicrotask(() =>
      loadPage(0)
        .then(() => (initialSeq ? open(initialSeq) : undefined))
        .catch((e) => setError(e.message)),
    );
  }, [loadPage, open, initialSeq]);
  // Durante l’incontro: aggiornamento automatico mentre la pagina è visibile e la sessione è aperta.
  useEffect(() => {
    if (base?.session.status !== "open") return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      (tab === "stats" ? loadStats() : loadPage(page.offset)).catch(() => undefined);
    }, 20000);
    return () => clearInterval(timer);
  }, [base?.session.status, tab, loadStats, loadPage, page.offset]);

  async function exportFile(path: string, fallback: string) {
    setBusy(true);
    setError("");
    try {
      await downloadResponse(await api(path), fallback);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Esportazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  if (!base) return <section className="soci-card">{error ? <p role="alert">{error}</p> : <p role="status">Caricamento risultati…</p>}</section>;
  const { session, questionnaire, questions } = base;
  return (
    <>
      <section className="soci-card">
        <div className="qs-toolbar">
          <button onClick={() => go({ kind: "detail", id: questionnaire.id })}>← {questionnaire.title}</button>
          <span className={"qs-badge " + (session.status === "open" ? "qs-open" : "qs-closed")}>{session.status === "open" ? "Sessione aperta" : "Sessione chiusa"}</span>
        </div>
        <h2>Risultati · {session.label}</h2>
        <p className="qs-muted">
          {(tab === "stats" && stats ? stats.total : page.total)}{" "}
          {(tab === "stats" && stats ? stats.total : page.total) === 1 ? "compilazione ricevuta" : "compilazioni ricevute"}
          {session.status === "open" && " · aggiornamento automatico ogni 20 secondi"}
        </p>
        <div className="soci-actions">
          <button disabled={busy} onClick={() => void exportFile(`export.csv?${query}`, "risultati.csv")}>
            Esporta CSV / Excel
          </button>
          <button disabled={busy} onClick={() => void exportFile(`export.pdf?${query}`, "risultati.pdf")}>
            Esporta PDF (tutte le schede)
          </button>
        </div>
        <nav className="soci-tabs qs-filter" aria-label="Tipo di consultazione">
          <button aria-pressed={tab === "cards"} onClick={() => setTab("cards")}>
            Schede individuali
          </button>
          <button
            aria-pressed={tab === "stats"}
            onClick={() => {
              setTab("stats");
              loadStats().catch((e) => setError(e.message));
            }}
          >
            Statistiche
          </button>
        </nav>
        {error && (
          <p className="soci-message" role="alert">
            {error}
          </p>
        )}
      </section>
      {tab === "cards" ? (
        <div className="qs-results">
          <section className="soci-card qs-index" aria-label="Elenco delle compilazioni">
            <h3>Compilazioni</h3>
            {page.items.length ? (
              <ul>
                {page.items.map((s) => (
                  <li key={s.id}>
                    <button aria-current={current?.submission.seq === s.seq} onClick={() => void open(s.seq)}>
                      <strong>{anonymousLabel(s.seq)}</strong>
                      <small>{qsDateTime(s.submitted_at)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nessuna compilazione ricevuta finora.</p>
            )}
            {page.total > PAGE && (
              <div className="qs-pager">
                <button disabled={page.offset === 0} onClick={() => void loadPage(Math.max(0, page.offset - PAGE))}>
                  ← Precedenti
                </button>
                <span>
                  {page.offset + 1}–{Math.min(page.offset + PAGE, page.total)} di {page.total}
                </span>
                <button disabled={page.offset + PAGE >= page.total} onClick={() => void loadPage(page.offset + PAGE)}>
                  Successive →
                </button>
              </div>
            )}
          </section>
          <section className="soci-card qs-card" id="qs-card" aria-live="polite">
            {current ? (
              <>
                <div className="qs-card-head">
                  <div>
                    <h3>{anonymousLabel(current.submission.seq)}</h3>
                    <small>Inviata il {qsDateTime(current.submission.submitted_at)}</small>
                  </div>
                  <div className="soci-actions">
                    <button disabled={current.prev === null} onClick={() => current.prev !== null && void open(current.prev)}>
                      ← Precedente
                    </button>
                    <button disabled={current.next === null} onClick={() => current.next !== null && void open(current.next)}>
                      Successiva →
                    </button>
                    <button disabled={busy} onClick={() => void exportFile(`export.pdf?${query}&seq=${current.submission.seq}`, "scheda.pdf")}>
                      PDF della scheda
                    </button>
                  </div>
                </div>
                <Answers questions={questions} submission={current.submission} />
              </>
            ) : (
              <p className="qs-muted">Seleziona una compilazione per leggere tutte le risposte della stessa persona.</p>
            )}
          </section>
        </div>
      ) : (
        <section className="soci-card qs-stats">
          {!stats ? (
            <p role="status">Caricamento statistiche…</p>
          ) : (
            <>
              <div className="soci-stats">
                <article>
                  <span>Partecipanti (compilazioni inviate)</span>
                  <strong>{stats.total}</strong>
                </article>
                <article>
                  <span>Compilazioni complete</span>
                  <strong>{stats.total}</strong>
                </article>
              </div>
              <p className="qs-muted">Ogni compilazione viene salvata solo quando è completa: non esistono invii parziali.</p>
              {questions.map((q, n) => {
                const s = stats.questions.find((x) => x.id === q.id);
                const answered = s?.answered ?? 0;
                return (
                  <article key={q.id} className="qs-stat">
                    <h3 className="qs-pre">
                      {n + 1}. {q.prompt}
                    </h3>
                    <p className="qs-muted">
                      {kindLabels[q.kind]} · {answered} risposte su {stats.total}
                      {q.kind === "multiple" && " · percentuali sul totale delle compilazioni"}
                    </p>
                    {q.kind === "text" ? (
                      <>
                        <button
                          onClick={() =>
                            void api(`texts?${query}&question=${q.id}`)
                              .then((r) => r.json())
                              .then((d) => setTexts((t) => ({ ...t, [q.id]: d.items })))
                              .catch((e) => setError(e.message))
                          }
                        >
                          {texts[q.id] ? "Aggiorna le risposte" : "Leggi tutte le risposte scritte"}
                        </button>
                        {texts[q.id] && (
                          <ul className="qs-texts">
                            {texts[q.id].map((t) => (
                              <li key={t.seq}>
                                <button className="qs-link" onClick={() => { setTab("cards"); void open(t.seq); }}>
                                  {anonymousLabel(t.seq)}
                                </button>
                                <p className="qs-pre qs-free">{t.text}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <ul className="qs-bars">
                        {q.options.map((o) => {
                          const count = s?.options.find((x) => x.id === o.id)?.count ?? 0;
                          const of = q.kind === "multiple" ? stats.total : answered;
                          return (
                            <li key={o.id}>
                              <div className="qs-bar-label">
                                <span>{o.label}</span>
                                <strong>
                                  {count} · {percent(count, of)}
                                </strong>
                              </div>
                              <div className="qs-bar" aria-hidden="true">
                                <span style={{ width: of ? `${(count / of) * 100}%` : 0 }} />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </article>
                );
              })}
              <button onClick={() => void loadStats().catch((e) => setError(e.message))}>Aggiorna statistiche</button>
            </>
          )}
        </section>
      )}
      <DeleteResults api={api} session={session} onDone={() => go({ kind: "detail", id: questionnaire.id })} />
    </>
  );
}

function DeleteResults({ api, session, onDone }: { api: QsApi; session: QsSession; onDone: () => void }) {
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  return (
    <details className="soci-card qs-delete">
      <summary>Cancellazione dei risultati di questa sessione</summary>
      <p>
        Elimina definitivamente tutte le compilazioni della sessione «{session.label}». L’operazione non è reversibile:
        esporta prima CSV o PDF se devi conservarne una copia. Per confermare scrivi il nome esatto della sessione.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          api("delete-results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: session.id, confirm }) })
            .then(onDone)
            .catch((err) => setError(err.message));
        }}
      >
        <label>
          Nome della sessione
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <button className="qs-danger" disabled={confirm !== session.label}>
          Elimina definitivamente i risultati
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </details>
  );
}
