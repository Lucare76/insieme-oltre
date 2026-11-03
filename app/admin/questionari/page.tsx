"use client";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { accessLabel, type AssociationRole } from "../../../lib/accounting";
import { statusLabels, type QsSession, type Questionnaire } from "../../../lib/questionnaires";
import { clearAdminSession, SESSION_KEY, useQsApi } from "./useQsApi";
import { QuestionnaireEditor } from "./QuestionnaireEditor";
import { QuestionnaireDetail } from "./QuestionnaireDetail";
import { SessionResults } from "./SessionResults";
import "../../area-soci/soci.css";
import "./questionari.css";

type User = { id: string; name: string; role: AssociationRole; psychologist: boolean };
type Item = Questionnaire & { qs_sessions: Pick<QsSession, "id" | "label" | "status" | "submission_count" | "meeting_date" | "created_at">[] };
export type View =
  | { kind: "list" }
  | { kind: "edit"; id?: string }
  | { kind: "detail"; id: string }
  | { kind: "results"; session: string; seq?: number };
type Filter = "draft" | "published" | "archived";

export default function QuestionariPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [view, setView] = useState<View>({ kind: "list" });
  const [filter, setFilter] = useState<Filter>("published");
  const onExpired = useCallback((text: string) => {
    setUser(null);
    setMessage(text);
  }, []);
  const api = useQsApi(onExpired);
  const reload = useCallback(async () => {
    const data = await (await api("list")).json();
    setUser(data.user);
    setItems(data.items);
  }, [api]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!localStorage.getItem(SESSION_KEY)) {
        setReady(true);
        return;
      }
      reload()
        .catch((e) => active && setMessage(e instanceof Error ? e.message : "Accesso non riuscito."))
        .finally(() => active && setReady(true));
    });
    return () => {
      active = false;
    };
  }, [reload]);

  const go = useCallback(
    (next: View) => {
      setMessage("");
      setView(next);
      window.scrollTo({ top: 0 });
      if (next.kind === "list") reload().catch((e) => setMessage(e.message));
    },
    [reload],
  );
  async function logout() {
    const stored = localStorage.getItem(SESSION_KEY);
    const token = stored ? JSON.parse(stored).access_token : "";
    await fetch("/api/associazione/logout", { method: "POST", headers: { Authorization: "Bearer " + token } }).catch(() => undefined);
    clearAdminSession();
    router.replace("/admin");
  }

  if (!ready)
    return (
      <main className="soci qs-admin">
        <p role="status">Caricamento area questionari…</p>
      </main>
    );
  const openSessions = items.flatMap((q) =>
    q.qs_sessions.filter((s) => s.status === "open").map((s) => ({ ...s, questionnaire: q })),
  );
  const groups: Record<Filter, Item[]> = {
    draft: items.filter((q) => q.status === "draft"),
    published: items.filter((q) => q.status === "published" || q.status === "closed"),
    archived: items.filter((q) => q.status === "archived"),
  };
  return (
    <main className="soci qs-admin">
      <div className="soci-shell">
        <header className="soci-header">
          <Link href="/">
            <Image src="/insieme-oltre-logo.png" alt="Insieme Oltre" width={150} height={112} />
          </Link>
          <div>
            <p className="soci-kicker">Insieme Oltre ODV · Area riservata</p>
            <h1>Questionari</h1>
            <p>{user ? `${user.name} · ${accessLabel(user)}` : "Questionari digitali per gli incontri dell’associazione."}</p>
          </div>
          {user && (
            <div className="qs-header-actions">
              {user.role !== "none" && <Link href="/admin">Menu principale</Link>}
              <button onClick={() => void logout()}>Esci</button>
            </div>
          )}
        </header>
        {message && (
          <p className="soci-message" role="alert">
            {message}
          </p>
        )}
        {!user ? (
          <section className="soci-card">
            <h2>Accedi per continuare</h2>
            <p>L’area questionari usa lo stesso accesso dell’area riservata.</p>
            <Link className="qs-button primary" href="/admin">
              Vai all’accesso
            </Link>
          </section>
        ) : view.kind === "edit" ? (
          <QuestionnaireEditor api={api} id={view.id} go={go} />
        ) : view.kind === "detail" ? (
          <QuestionnaireDetail api={api} id={view.id} go={go} />
        ) : view.kind === "results" ? (
          <SessionResults api={api} sessionId={view.session} initialSeq={view.seq} go={go} />
        ) : (
          <>
            <section className="soci-card qs-intro-card">
              <div>
                <h2>Ciao, {user.name}</h2>
                <p>Crea un questionario, pubblicalo e mostra il QR code durante l’incontro. I partecipanti rispondono dal telefono, senza registrarsi.</p>
              </div>
              <button className="primary qs-big" onClick={() => go({ kind: "edit" })}>
                + Crea nuovo questionario
              </button>
            </section>
            <section className="soci-card" aria-labelledby="qs-live">
              <h2 id="qs-live">Sessioni attive</h2>
              {openSessions.length ? (
                <ul className="qs-list">
                  {openSessions.map((s) => (
                    <li key={s.id}>
                      <div>
                        <span className="qs-badge qs-open">Aperta</span>
                        <strong>{s.questionnaire.title}</strong>
                        <small>
                          {s.label} · {s.submission_count} {s.submission_count === 1 ? "compilazione" : "compilazioni"}
                        </small>
                      </div>
                      <div className="soci-actions">
                        <button onClick={() => go({ kind: "detail", id: s.questionnaire.id })}>QR code e link</button>
                        <button className="primary" onClick={() => go({ kind: "results", session: s.id })}>
                          Risultati
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Nessuna sessione aperta in questo momento.</p>
              )}
            </section>
            <section className="soci-card">
              <nav className="soci-tabs qs-filter" aria-label="Stato dei questionari">
                {(["published", "draft", "archived"] as Filter[]).map((f) => (
                  <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                    {f === "published" ? "Pubblicati e chiusi" : f === "draft" ? "Bozze" : "Archivio"} ({groups[f].length})
                  </button>
                ))}
              </nav>
              {groups[filter].length ? (
                <ul className="qs-list">
                  {groups[filter].map((q) => {
                    const total = q.qs_sessions.reduce((sum, s) => sum + s.submission_count, 0);
                    return (
                      <li key={q.id}>
                        <div>
                          <span className={"qs-badge qs-" + q.status}>{statusLabels[q.status]}</span>
                          <strong>{q.title}</strong>
                          <small>
                            {q.meeting_ref && <>{q.meeting_ref} · </>}
                            {q.qs_sessions.length} {q.qs_sessions.length === 1 ? "sessione" : "sessioni"} · {total}{" "}
                            {total === 1 ? "compilazione" : "compilazioni"}
                            {user.role === "owner" && q.owner_id !== user.id && " · di un’altra professionista"}
                          </small>
                        </div>
                        <div className="soci-actions">
                          <button className="primary" onClick={() => go({ kind: "detail", id: q.id })}>
                            Apri
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>
                  {filter === "draft"
                    ? "Nessuna bozza. Crea un nuovo questionario per iniziare."
                    : filter === "published"
                      ? "Nessun questionario pubblicato."
                      : "L’archivio è vuoto."}
                </p>
              )}
            </section>
          </>
        )}
        <footer>
          <Link href="/">← Torna al sito</Link>
          <span>Insieme Oltre · Questionari</span>
        </footer>
      </div>
    </main>
  );
}
