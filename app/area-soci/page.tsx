"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  balances,
  categories,
  csvCell,
  kindLabels,
  roleLabels,
  type AssociationRole,
  type Movement,
} from "../../lib/accounting";
import "./soci.css";
type User = { id: string; name: string; role: AssociationRole };
type Session = {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  started_at: number;
};
type Item = Movement & { private_note?: string };
type Member = {
  user_id: string;
  name: string;
  email: string;
  role: "member" | "accountant";
  active: boolean;
};
type Audit = {
  id: number;
  created_at: string;
  entity_id: string;
  actor_id: string;
  action: string;
  before_data: unknown;
  after_data: unknown;
};
const KEY = "insieme_oltre_association_v1";
const money = (n: number) =>
  (n / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const dateLabel = (v: string) => v.split("-").reverse().join("/");
const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(
    new Date(),
  );
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function AreaSoci() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [tab, setTab] = useState("register");
  const [editing, setEditing] = useState<Item | null | undefined>(undefined);
  const [year, setYear] = useState("");
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [memberEdit, setMemberEdit] = useState<Member | null>(null);
  const [documents, setDocuments] = useState<
    { id: string; filename: string }[]
  >([]);
  const [documentItem, setDocumentItem] = useState<Item | null>(null);
  const session = useRef<Session | null>(null);
  const renewing = useRef<Promise<void> | null>(null);
  const lastActivity = useRef(0);
  const clear = useCallback(() => {
    session.current = null;
    sessionStorage.removeItem(KEY);
    setUser(null);
    setItems([]);
    setDataLoaded(false);
    setMembers([]);
    setAudit([]);
    setDocuments([]);
    setDocumentItem(null);
    setEditing(undefined);
    setMemberEdit(null);
  }, []);
  const api = useCallback(
    async (path: string, init: RequestInit = {}) => {
      if (
        !session.current ||
        Date.now() - session.current.started_at > 8 * 3600000 ||
        Date.now() - lastActivity.current > 3600000
      ) {
        clear();
        throw new Error("Sessione scaduta. Accedi nuovamente.");
      }
      if (
        session.current.expires_at * 1000 < Date.now() + 60000 &&
        session.current.refresh_token
      ) {
        renewing.current ??= (async () => {
          const r = await fetch("/api/associazione/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              refresh_token: session.current?.refresh_token,
            }),
          });
          const b = await r.json();
          if (!r.ok) {
            clear();
            throw new Error(b.error);
          }
          session.current = {
            ...b.session,
            started_at: session.current!.started_at,
          };
          sessionStorage.setItem(KEY, JSON.stringify(session.current));
        })().finally(() => {
          renewing.current = null;
        });
        await renewing.current;
      }
      const res = await fetch("/api/associazione/" + path, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: "Bearer " + session.current?.access_token,
        },
        cache: "no-store",
      });
      if (!res.ok) {
        const b = await res.json();
        if (res.status === 401 || (res.status === 403 && path === "me"))
          clear();
        throw new Error(b.error || "Operazione non riuscita.");
      }
      return res;
    },
    [clear],
  );
  const load = useCallback(async () => {
    const res = await api("movements");
    setItems((await res.json()).items);
    setDataLoaded(true);
  }, [api]);
  useEffect(() => {
    let active = true;
    lastActivity.current = Date.now();
    async function init() {
      try {
        const saved = sessionStorage.getItem(KEY);
        const admin = localStorage.getItem("insieme_oltre_admin_session");
        const value = saved
          ? JSON.parse(saved)
          : admin
            ? { ...JSON.parse(admin), started_at: Date.now() }
            : null;
        if (
          value?.access_token &&
          typeof value.expires_at === "number" &&
          typeof value.started_at === "number"
        ) {
          session.current = value;
          const res = await api("me");
          const data = await res.json();
          if (active) {
            setUser(data.user);
            await load();
          }
        }
      } catch (error) {
        if (active) {
          clear();
          setMessage(
            error instanceof Error ? error.message : "Accedi nuovamente.",
          );
        }
      } finally {
        if (active) setReady(true);
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [api, load, clear]);
  useEffect(() => {
    const activity = () => {
      lastActivity.current = Date.now();
    };
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    const timer = setInterval(() => {
      if (
        session.current &&
        (Date.now() - lastActivity.current > 3600000 ||
          Date.now() - session.current.started_at > 8 * 3600000)
      ) {
        clear();
        setMessage("Sessione terminata per sicurezza.");
      }
    }, 30000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
    };
  }, [clear]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Operazione non riuscita.",
      );
    } finally {
      setBusy(false);
    }
  }
  const post = async (path: string, body: unknown) =>
    api(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(async () => {
      const res = await fetch("/api/associazione/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(data)),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error);
      session.current = { ...b.session, started_at: Date.now() };
      lastActivity.current = Date.now();
      sessionStorage.setItem(KEY, JSON.stringify(session.current));
      setUser(b.user);
      await load();
    });
  }
  const write = user?.role !== "member";
  const filtered = items.filter(
    (x) =>
      (!year || x.date.startsWith(year)) &&
      (!project || x.project === project) &&
      (showCancelled || !x.cancelled) &&
      `${x.description} ${x.category} ${x.project}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const totals = balances(items);
  const period = balances(filtered);
  const projects = [
    ...new Set(items.map((x) => x.project).filter(Boolean)),
  ].sort();
  const years = [...new Set(items.map((x) => x.date.slice(0, 4)))]
    .sort()
    .reverse();
  async function openTab(value: string) {
    setTab(value);
    await run(async () => {
      if (value === "members")
        setMembers((await (await api("members")).json()).items);
      if (value === "audit")
        setAudit((await (await api("audit")).json()).items);
    });
  }
  async function openDocuments(item: Item) {
    setDocumentItem(item);
    setDocuments([]);
    await run(async () =>
      setDocuments(
        (await (await api("documents?movement_id=" + item.id)).json()).items,
      ),
    );
  }
  if (!ready)
    return (
      <main className="soci">
        <p role="status">Caricamento area riservata…</p>
      </main>
    );
  return (
    <main className="soci">
      <div className="soci-shell">
        <header className="soci-header">
          <Link href="/">
            <Image
              src="/insieme-oltre-logo.png"
              alt="Insieme Oltre"
              width={150}
              height={112}
            />
          </Link>
          <div>
            <p className="soci-kicker">Insieme Oltre ODV</p>
            <h1>Area soci</h1>
            <p>
              {user
                ? `${user.name} · ${roleLabels[user.role]}`
                : "Uno spazio riservato per i conti dell’associazione."}
            </p>
          </div>
          {user && (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api("logout", { method: "POST" });
                  clear();
                })
              }
            >
              Esci
            </button>
          )}
        </header>
        {message && (
          <p className="soci-message" role="alert">
            {message}
          </p>
        )}
        {!user ? (
          <form className="soci-card soci-login" onSubmit={login}>
            <h2>Accedi</h2>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={254}
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={200}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Accesso…" : "Entra nell’area soci"}
            </button>
            <p>
              L’accesso viene abilitato dall’admin dell’associazione. Per
              recuperare la password, contattalo.
            </p>
            <Link href="/admin">Accesso admin principale →</Link>
          </form>
        ) : (
          <>
            <nav className="soci-tabs" aria-label="Sezioni area soci">
              <button
                aria-pressed={tab === "register"}
                onClick={() => void openTab("register")}
              >
                Contabilità
              </button>
              {user.role === "owner" && (
                <>
                  <button
                    aria-pressed={tab === "members"}
                    onClick={() => void openTab("members")}
                  >
                    Utenti e permessi
                  </button>
                  <button
                    aria-pressed={tab === "audit"}
                    onClick={() => void openTab("audit")}
                  >
                    Storico operazioni
                  </button>
                  <Link href="/admin">Gestione sito →</Link>
                </>
              )}
            </nav>
            {tab === "register" && (
              <>
                <section className="soci-stats" aria-label="Saldi complessivi">
                  <article>
                    <span>Cassa</span>
                    <strong>{dataLoaded ? money(totals.cash) : "—"}</strong>
                  </article>
                  <article>
                    <span>Conto bancario</span>
                    <strong>{dataLoaded ? money(totals.bank) : "—"}</strong>
                  </article>
                  <article>
                    <span>Disponibilità totale</span>
                    <strong>{dataLoaded ? money(totals.cash + totals.bank) : "—"}</strong>
                  </article>
                </section>
                <div className="soci-toolbar">
                  <div>
                    <h2>Entrate e uscite</h2>
                    <p>
                      Saldi su tutti i movimenti attivi. Entrate e uscite qui
                      sotto seguono i filtri.
                    </p>
                  </div>
                  <button disabled={busy} onClick={() => void run(load)}>
                    Aggiorna
                  </button>
                  {write && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => {
                        setNewDate(today());
                        setEditing(null);
                        setDocumentItem(null);
                      }}
                    >
                      + Nuovo movimento
                    </button>
                  )}
                </div>
                {editing !== undefined && write && (
                  <form
                    key={editing?.id ?? "new"}
                    className="soci-card"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const values = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      void run(async () => {
                        await post("movements", {
                          ...values,
                          ...(editing
                            ? { id: editing.id, version: editing.version }
                            : {}),
                        });
                        setEditing(undefined);
                        await load();
                        setMessage("Movimento salvato.");
                      });
                    }}
                  >
                    <h3>
                      {editing ? "Correggi movimento" : "Nuovo movimento"}
                    </h3>
                    <div className="soci-grid">
                      <label>
                        Data
                        <input
                          name="date"
                          type="date"
                          min="2000-01-01"
                          max="2199-12-31"
                          defaultValue={editing?.date ?? newDate}
                          required
                        />
                      </label>
                      <label>
                        Tipo
                        <select
                          name="kind"
                          defaultValue={editing?.kind ?? "income"}
                        >
                          {Object.entries(kindLabels).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Importo (€)
                        <input
                          name="amount"
                          inputMode="decimal"
                          placeholder="0,00"
                          defaultValue={
                            editing
                              ? (editing.amount_cents / 100).toFixed(2)
                              : ""
                          }
                          required
                        />
                      </label>
                      <label>
                        Conto / provenienza
                        <select
                          name="account"
                          defaultValue={editing?.account ?? "bank"}
                        >
                          <option value="bank">Conto bancario</option>
                          <option value="cash">Cassa contanti</option>
                        </select>
                      </label>
                      <label>
                        Categoria
                        <input
                          name="category"
                          list="categories"
                          defaultValue={editing?.category ?? ""}
                          required
                          maxLength={100}
                        />
                        <datalist id="categories">
                          {categories.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </datalist>
                      </label>
                      <label>
                        Iniziativa (facoltativa)
                        <input
                          name="project"
                          list="projects"
                          maxLength={120}
                          defaultValue={editing?.project ?? ""}
                        />
                        <datalist id="projects">
                          {projects.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </datalist>
                      </label>
                      <label className="wide">
                        Causale visibile ai soci
                        <input
                          name="description"
                          defaultValue={editing?.description ?? ""}
                          maxLength={500}
                          required
                        />
                      </label>
                      <label className="wide">
                        Note riservate agli amministratori
                        <textarea
                          name="private_note"
                          defaultValue={editing?.private_note ?? ""}
                          maxLength={1000}
                        />
                      </label>
                    </div>
                    <p>
                      Per un trasferimento indica il conto di provenienza: la
                      destinazione è l’altro conto. Il saldo iniziale non viene
                      conteggiato come entrata.
                    </p>
                    <div className="soci-actions">
                      <button className="primary" disabled={busy}>
                        Salva movimento
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(undefined)}
                      >
                        Chiudi
                      </button>
                    </div>
                  </form>
                )}
                <section className="soci-card">
                  <div className="soci-filters">
                    <label>
                      Anno
                      <select
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                      >
                        <option value="">Tutti gli anni</option>
                        {years.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Iniziativa
                      <select
                        value={project}
                        onChange={(e) => setProject(e.target.value)}
                      >
                        <option value="">Tutte le iniziative</option>
                        {projects.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Cerca
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Causale o categoria"
                      />
                    </label>
                    <label className="soci-check">
                      <input
                        type="checkbox"
                        checked={showCancelled}
                        onChange={(e) => setShowCancelled(e.target.checked)}
                      />
                      Mostra annullati
                    </label>
                  </div>
                  <p>
                    <strong>Entrate: {money(period.income)}</strong> · Uscite:{" "}
                    {money(period.expense)} · Differenza:{" "}
                    {money(period.income - period.expense)}
                  </p>
                  <button
                    onClick={() =>
                      download(
                        new Blob(
                          [
                            "\uFEFF" +
                              [
                                [
                                  "Data",
                                  "Tipo",
                                  "Importo EUR",
                                  "Conto",
                                  "Categoria",
                                  "Iniziativa",
                                  "Causale",
                                  "Stato",
                                ],
                                ...filtered.map((x) => [
                                  dateLabel(x.date),
                                  kindLabels[x.kind],
                                  (x.amount_cents / 100)
                                    .toFixed(2)
                                    .replace(".", ","),
                                  x.account === "bank" ? "Banca" : "Cassa",
                                  x.category,
                                  x.project,
                                  x.description,
                                  x.cancelled ? "Annullato" : "Attivo",
                                ]),
                              ]
                                .map((row) => row.map(csvCell).join(";"))
                                .join("\r\n"),
                          ],
                          { type: "text/csv;charset=utf-8" },
                        ),
                        "insieme-oltre-movimenti.csv",
                      )
                    }
                  >
                    Esporta i movimenti filtrati (CSV)
                  </button>
                  <div className="soci-table-wrap">
                    <table>
                      <caption>
                        {filtered.length} movimenti · gli annullati sono esclusi
                        dai totali
                      </caption>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Causale</th>
                          <th>Categoria / iniziativa</th>
                          <th>Conto</th>
                          <th>Importo</th>
                          {write && <th>Operazioni</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice(0, 500).map((item) => (
                          <tr
                            key={item.id}
                            className={item.cancelled ? "cancelled" : ""}
                          >
                            <td>{dateLabel(item.date)}</td>
                            <td>
                              <strong>{item.description}</strong>
                              <small>
                                {kindLabels[item.kind]}
                                {item.cancelled
                                  ? " · Annullato: " + item.cancellation_reason
                                  : ""}
                              </small>
                            </td>
                            <td>
                              {item.category}
                              <small>{item.project}</small>
                            </td>
                            <td>
                              {item.account === "bank" ? "Banca" : "Cassa"}
                              {item.kind === "transfer"
                                ? item.account === "bank"
                                  ? " → Cassa"
                                  : " → Banca"
                                : ""}
                            </td>
                            <td
                              className={
                                item.kind === "expense" ? "expense" : ""
                              }
                            >
                              {item.kind === "expense" ? "−" : ""}
                              {money(item.amount_cents)}
                            </td>
                            {write && (
                              <td>
                                <div className="soci-row-actions">
                                  {!item.cancelled && (
                                    <>
                                      <button
                                        disabled={busy}
                                        onClick={() => setEditing(item)}
                                      >
                                        Correggi
                                      </button>
                                      <button
                                        disabled={busy}
                                        onClick={() => {
                                          const reason = window.prompt(
                                            "Motivo dell’annullamento (10–500 caratteri):",
                                          );
                                          if (reason)
                                            void run(async () => {
                                              await post("movements", {
                                                id: item.id,
                                                version: item.version,
                                                cancel_reason: reason,
                                              });
                                              await load();
                                            });
                                        }}
                                      >
                                        Annulla
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => void openDocuments(item)}
                                  >
                                    Documenti
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!filtered.length && <p>Nessun movimento trovato.</p>}
                    {filtered.length > 500 && (
                      <p>
                        Mostrati i primi 500: restringi i filtri o esporta
                        l’elenco completo.
                      </p>
                    )}
                  </div>
                </section>
                {documentItem && write && (
                  <section className="soci-card">
                    <h3>Documenti · {documentItem.description}</h3>
                    <p>
                      Visibili agli amministratori. PDF, JPG e PNG fino a 3 MB.
                    </p>
                    <ul>
                      {documents.map((doc) => (
                        <li key={doc.id}>
                          <button
                            onClick={() =>
                              void run(async () =>
                                download(
                                  await (
                                    await api("document/" + doc.id)
                                  ).blob(),
                                  doc.filename,
                                ),
                              )
                            }
                          >
                            {doc.filename}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget);
                        form.set("movement_id", documentItem.id);
                        void run(async () => {
                          await api("documents", {
                            method: "POST",
                            body: form,
                          });
                          setDocuments(
                            (
                              await (
                                await api(
                                  "documents?movement_id=" + documentItem.id,
                                )
                              ).json()
                            ).items,
                          );
                          setMessage("Documento allegato.");
                        });
                      }}
                    >
                      <label>
                        Giustificativo
                        <input
                          name="file"
                          type="file"
                          accept="application/pdf,image/jpeg,image/png"
                          required
                        />
                      </label>
                      <button disabled={busy}>Allega documento</button>
                      <button
                        type="button"
                        onClick={() => setDocumentItem(null)}
                      >
                        Chiudi
                      </button>
                    </form>
                  </section>
                )}
                <section className="soci-card">
                  <h3>Le iniziative</h3>
                  {projects.length ? (
                    projects.map((p) => {
                      const b = balances(items.filter((x) => x.project === p));
                      return (
                        <p key={p}>
                          <strong>{p}</strong> · Entrate {money(b.income)} ·
                          Uscite {money(b.expense)} · Disponibile{" "}
                          {money(b.income - b.expense)}
                        </p>
                      );
                    })
                  ) : (
                    <p>
                      Le iniziative compariranno quando verranno collegate ai
                      movimenti.
                    </p>
                  )}
                </section>
              </>
            )}
            {tab === "members" && user.role === "owner" && (
              <section className="soci-card">
                <h2>Utenti e permessi</h2>
                <p>Solo tu puoi abilitare gli accessi e assegnare i ruoli.</p>
                <form
                  key={memberEdit?.user_id ?? "new-member"}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = Object.fromEntries(
                      new FormData(e.currentTarget),
                    );
                    void run(async () => {
                      await post("members", {
                        ...form,
                        active: form.active === "true",
                        ...(memberEdit ? { user_id: memberEdit.user_id } : {}),
                      });
                      setMemberEdit(null);
                      setMembers((await (await api("members")).json()).items);
                      setMessage("Accesso aggiornato.");
                    });
                  }}
                >
                  <div className="soci-grid">
                    <label>
                      Nome e cognome
                      <input
                        name="name"
                        required
                        maxLength={120}
                        defaultValue={memberEdit?.name}
                      />
                    </label>
                    <label>
                      Email
                      <input
                        name="email"
                        type="email"
                        required
                        maxLength={254}
                        readOnly={!!memberEdit}
                        defaultValue={memberEdit?.email}
                      />
                    </label>
                    <label>
                      {memberEdit
                        ? "Nuova password (facoltativa)"
                        : "Password iniziale"}
                      <input
                        name="password"
                        type="password"
                        required={!memberEdit}
                        minLength={12}
                        maxLength={200}
                        autoComplete="new-password"
                      />
                    </label>
                    <label>
                      Ruolo
                      <select
                        name="role"
                        defaultValue={memberEdit?.role ?? "member"}
                      >
                        <option value="member">Socio — consultazione</option>
                        <option value="accountant">
                          Amministratore contabile
                        </option>
                      </select>
                    </label>
                    <label>
                      Stato
                      <select
                        name="active"
                        defaultValue={
                          memberEdit?.active === false ? "false" : "true"
                        }
                      >
                        <option value="true">Attivo</option>
                        <option value="false">Disattivato</option>
                      </select>
                    </label>
                  </div>
                  <p>
                    La creazione non invia email. Comunica le credenziali
                    personalmente al socio.
                  </p>
                  <button className="primary" disabled={busy}>
                    {memberEdit ? "Salva permessi" : "Crea accesso"}
                  </button>
                  {memberEdit && (
                    <button type="button" onClick={() => setMemberEdit(null)}>
                      Chiudi modifica
                    </button>
                  )}
                </form>
                <ul className="soci-members">
                  {members.map((m) => (
                    <li key={m.user_id}>
                      <div>
                        <strong>{m.name}</strong>
                        <small>
                          {m.email} · {roleLabels[m.role]} ·{" "}
                          {m.active ? "Attivo" : "Disattivato"}
                        </small>
                      </div>
                      <button onClick={() => setMemberEdit(m)}>Gestisci</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {tab === "audit" && user.role === "owner" && (
              <section className="soci-card">
                <h2>Storico delle operazioni</h2>
                <p>Movimenti e variazioni dei permessi, dal più recente.</p>
                {audit.map((a) => (
                  <details key={a.id}>
                    <summary>
                      {new Date(a.created_at).toLocaleString("it-IT")} ·{" "}
                      {a.action} · {a.entity_id}
                    </summary>
                    <p>
                      Utente:{" "}
                      {members.find((m) => m.user_id === a.actor_id)?.name ??
                        (a.actor_id === user.id ? user.name : a.actor_id)}
                    </p>
                    <pre>
                      {JSON.stringify(
                        { prima: a.before_data, dopo: a.after_data },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                ))}
                <button
                  disabled={busy || audit.length % 100 !== 0 || !audit.length}
                  onClick={() =>
                    void run(async () =>
                      setAudit([
                        ...audit,
                        ...(
                          await (
                            await api("audit?offset=" + audit.length)
                          ).json()
                        ).items,
                      ]),
                    )
                  }
                >
                  Carica operazioni precedenti
                </button>
              </section>
            )}
          </>
        )}
        <footer>
          <Link href="/">← Torna al sito</Link>
          <span>Insieme Oltre · Area riservata</span>
        </footer>
      </div>
    </main>
  );
}
