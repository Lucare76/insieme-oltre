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
import "../area-soci/soci.css";
import dynamic from "next/dynamic";
import {
  readSessionTimes,
  storeSessionTimes,
  SESSION_TIMES_KEY,
} from "./sessionTimeout";
const ContentEditor = dynamic(() => import("./ContentEditor"));
import { AccountingDashboard } from "./AccountingDashboard";
import { AccessForms, AccessRequests } from "./accessComponents";
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
  username: string | null;
  activated_at: string | null;
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
const KEY = "insieme_oltre_admin_session";
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
  const [tab, setTab] = useState("home");
  const [pending, setPending] = useState(0);
  const [editing, setEditing] = useState<Item | null | undefined>(undefined);
  const [year, setYear] = useState("");
  const [reportYear, setReportYear] = useState(() => today().slice(0, 4));
  const [accountFilter, setAccountFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [movementKind, setMovementKind] = useState("income");
  const [movementAccount, setMovementAccount] = useState("bank");
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [memberEdit, setMemberEdit] = useState<Member | null>(null);
  const [documents, setDocuments] = useState<
    { id: string; filename: string }[]
  >([]);
  const [documentItem, setDocumentItem] = useState<Pick<
    Item,
    "id" | "description"
  > | null>(null);
  const session = useRef<Session | null>(null);
  const renewing = useRef<Promise<void> | null>(null);
  const lastActivity = useRef(0);
  const clear = useCallback(() => {
    session.current = null;
    localStorage.removeItem(KEY);
    localStorage.removeItem(SESSION_TIMES_KEY);
    sessionStorage.removeItem("insieme_oltre_association_v1");
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
      const times = readSessionTimes();
      const stored = localStorage.getItem(KEY);
      if (!stored) {
        clear();
        throw new Error("Sessione chiusa. Accedi nuovamente.");
      }
      try {
        const current = JSON.parse(stored);
        if (current.access_token !== session.current?.access_token)
          session.current = { ...current, started_at: times?.loginAt ?? 0 };
      } catch {
        clear();
        throw new Error("Accedi nuovamente.");
      }
      if (times)
        lastActivity.current = Math.max(
          lastActivity.current,
          times.lastActivityAt,
        );

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
          localStorage.setItem(KEY, JSON.stringify(session.current));
        })().finally(() => {
          renewing.current = null;
        });
        await renewing.current;
      }
      const res = await fetch(
        path.startsWith("access/")
          ? "/api/accesso/" + path.slice(7)
          : "/api/associazione/" + path,
        {
          ...init,
          headers: {
            ...init.headers,
            Authorization: "Bearer " + session.current?.access_token,
          },
          cache: "no-store",
        },
      );
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
        const saved = localStorage.getItem(KEY);
        const times = readSessionTimes();
        const parsed = saved ? JSON.parse(saved) : null;
        const value =
          parsed && times ? { ...parsed, started_at: times.loginAt } : null;
        lastActivity.current = times?.lastActivityAt ?? 0;
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
            if (data.user.role === "owner") {
              const requests = await (await api("access/requests")).json();
              setPending(
                requests.items.filter(
                  (x: { status: string }) => x.status === "pending",
                ).length,
              );
            }
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
      if (!session.current) return;
      if (
        Date.now() - lastActivity.current > 3600000 ||
        Date.now() - session.current.started_at > 8 * 3600000
      ) {
        clear();
        return;
      }
      lastActivity.current = Date.now();
      storeSessionTimes({
        loginAt: session.current.started_at,
        lastActivityAt: lastActivity.current,
      });
    };
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_TIMES_KEY) {
        const times = readSessionTimes();
        if (times) lastActivity.current = times.lastActivityAt;
      }
      if (event.key === KEY) {
        if (!event.newValue) clear();
        else
          try {
            session.current = {
              ...JSON.parse(event.newValue),
              started_at: readSessionTimes()?.loginAt ?? 0,
            };
          } catch {
            clear();
          }
      }
    };
    window.addEventListener("storage", onStorage);
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
      window.removeEventListener("storage", onStorage);
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
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(data)),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error);
      session.current = { ...b.session, started_at: Date.now() };
      lastActivity.current = Date.now();
      localStorage.setItem(KEY, JSON.stringify(session.current));
      storeSessionTimes({ loginAt: Date.now(), lastActivityAt: Date.now() });
      setUser(b.user);
      setTab("home");
      if (b.user.role === "owner") {
        const requests = await (await api("access/requests")).json();
        setPending(
          requests.items.filter(
            (x: { status: string }) => x.status === "pending",
          ).length,
        );
      }
    });
  }
  const write = user?.role !== "member";
  const filtered = items.filter(
    (x) =>
      (!year || x.date.startsWith(year)) &&
      (!project || x.project === project) &&
      (!accountFilter ||
        x.account === accountFilter ||
        x.kind === "transfer") &&
      (!categoryFilter || x.category === categoryFilter) &&
      (!kindFilter || x.kind === kindFilter) &&
      (showCancelled || !x.cancelled) &&
      `${x.description} ${x.category} ${x.project}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const period = balances(filtered);
  const projects = [
    ...new Set(items.map((x) => x.project).filter(Boolean)),
  ].sort();
  const years = [...new Set(items.map((x) => x.date.slice(0, 4)))]
    .sort()
    .reverse();
  function newMovement(kind: "income" | "expense" = "income") {
    setNewDate(today());
    setMovementKind(kind);
    setMovementAccount("bank");
    setEditing(null);
    setDocumentItem(null);
    requestAnimationFrame(() =>
      document
        .getElementById("movement-editor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  async function openTab(value: string) {
    setTab(value);
    await run(async () => {
      if (value === "register") await load();
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
            <h1>Area riservata</h1>
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
          <div className="soci-card soci-login">
            <form onSubmit={login}>
              <h2>Accedi</h2>
              <label>
                Nome utente
                <input
                  name="username"
                  type="text"
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
            </form>
            <AccessForms />
          </div>
        ) : (
          <>
            <nav className="soci-tabs" aria-label="Sezioni area soci">
              <button
                aria-pressed={tab === "home"}
                onClick={() => void openTab("home")}
              >
                Menu
              </button>
              <button
                aria-pressed={tab === "register"}
                onClick={() => void openTab("register")}
              >
                Contabilità
              </button>
              {user.role === "owner" && (
                <>
                  <button
                    aria-pressed={tab === "requests"}
                    onClick={() => void openTab("requests")}
                  >
                    Richieste di accesso {pending > 0 ? `(${pending})` : ""}
                  </button>
                  <button
                    aria-pressed={tab === "contents"}
                    onClick={() => void openTab("contents")}
                  >
                    Gestione sito
                  </button>
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
                  <Link href="/admin/partecipazioni">
                    Le idee delle famiglie →
                  </Link>
                </>
              )}
            </nav>
            {tab === "home" && (
              <section className="soci-card">
                <h2>Benvenuto, {user.name}</h2>
                <p>
                  {user.role === "owner"
                    ? "Da questo menu gestisci il sito, la contabilità e gli accessi dell’associazione."
                    : user.role === "accountant"
                      ? "Puoi consultare e registrare i movimenti dell’associazione."
                      : "Puoi consultare i movimenti e i riepiloghi dell’associazione."}
                </p>
                <div className="soci-menu-cards">
                  <button onClick={() => void openTab("register")}>
                    <strong>Contabilità</strong>
                    <span>Entrate, uscite, cassa e banca</span>
                  </button>
                  {user.role === "owner" && (
                    <>
                      <button onClick={() => void openTab("contents")}>
                        <strong>Gestione sito</strong>
                        <span>Testi e storie dei bambini</span>
                      </button>
                      <button onClick={() => void openTab("requests")}>
                        <strong>
                          Richieste di accesso{" "}
                          {pending > 0 ? `· ${pending}` : ""}
                        </strong>
                        <span>Approva e assegna il ruolo</span>
                      </button>
                      <button onClick={() => void openTab("members")}>
                        <strong>Utenti e permessi</strong>
                        <span>Gestisci account e inviti</span>
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}
            {tab === "contents" && user.role === "owner" && <ContentEditor />}
            {tab === "requests" && user.role === "owner" && (
              <AccessRequests api={api} onPending={setPending} />
            )}
            {tab === "register" && (
              <>
                <AccountingDashboard
                  items={items}
                  loaded={dataLoaded}
                  year={reportYear}
                  onYear={setReportYear}
                  onNew={write ? newMovement : undefined}
                  busy={busy}
                />
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
                        newMovement();
                      }}
                    >
                      + Nuovo movimento
                    </button>
                  )}
                </div>
                {editing !== undefined && write && (
                  <form
                    key={editing?.id ?? "new"}
                    id="movement-editor"
                    className="soci-card"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const values = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      const attach =
                        (e.nativeEvent as SubmitEvent).submitter instanceof
                          HTMLButtonElement &&
                        (
                          (e.nativeEvent as SubmitEvent)
                            .submitter as HTMLButtonElement
                        ).value === "attach";
                      void run(async () => {
                        const saved = await (
                          await post("movements", {
                            ...values,
                            ...(editing
                              ? { id: editing.id, version: editing.version }
                              : {}),
                          })
                        ).json();
                        setEditing(undefined);
                        await load();
                        setMessage("Movimento salvato.");
                        if (attach && saved.id) {
                          setDocumentItem({
                            id: saved.id,
                            description: String(values.description),
                          });
                          setDocuments(
                            (
                              await (
                                await api("documents?movement_id=" + saved.id)
                              ).json()
                            ).items,
                          );
                        }
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
                          value={movementKind}
                          onChange={(e) => setMovementKind(e.target.value)}
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
                        {movementKind === "transfer" ? "Dal conto" : "Conto"}
                        <select
                          name="account"
                          value={movementAccount}
                          onChange={(e) => setMovementAccount(e.target.value)}
                        >
                          <option value="bank">Conto bancario</option>
                          <option value="cash">Cassa contanti</option>
                        </select>
                      </label>
                      {movementKind === "transfer" && (
                        <p className="accounting-transfer">
                          Al conto:{" "}
                          <strong>
                            {movementAccount === "cash"
                              ? "Conto bancario"
                              : "Cassa contanti"}
                          </strong>
                          <small>
                            Un solo movimento aggiorna entrambi i conti.
                          </small>
                        </p>
                      )}
                      <label>
                        Categoria
                        <input
                          name="category"
                          list="categories"
                          defaultValue={editing?.category ?? ""}
                          placeholder="Scegli o scrivi una categoria"
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
                      <button type="submit" value="attach" disabled={busy}>
                        Salva e allega documento
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
                      Conto
                      <select
                        value={accountFilter}
                        onChange={(e) => setAccountFilter(e.target.value)}
                      >
                        <option value="">Cassa e banca</option>
                        <option value="cash">Cassa contanti</option>
                        <option value="bank">Conto bancario</option>
                      </select>
                    </label>
                    <label>
                      Tipo
                      <select
                        value={kindFilter}
                        onChange={(e) => setKindFilter(e.target.value)}
                      >
                        <option value="">Tutti i tipi</option>
                        {Object.entries(kindLabels).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Categoria
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                      >
                        <option value="">Tutte le categorie</option>
                        {[...new Set(items.map((x) => x.category))]
                          .sort()
                          .map((c) => (
                            <option key={c}>{c}</option>
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
                    <strong>Entrate filtrate: {money(period.income)}</strong> ·
                    Uscite: {money(period.expense)} · Differenza:{" "}
                    {money(period.income - period.expense)}
                  </p>
                  <p className="accounting-muted">
                    I filtri riguardano il registro e il CSV; il cruscotto
                    mantiene i saldi complessivi. I trasferimenti compaiono in
                    entrambi i conti.
                  </p>
                  <button
                    onClick={() => {
                      setYear("");
                      setProject("");
                      setSearch("");
                      setAccountFilter("");
                      setCategoryFilter("");
                      setKindFilter("");
                      setShowCancelled(false);
                    }}
                  >
                    Azzera filtri
                  </button>{" "}
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
                                  x.kind === "transfer"
                                    ? x.account === "bank"
                                      ? "Banca → Cassa"
                                      : "Cassa → Banca"
                                    : x.account === "bank"
                                      ? "Banca"
                                      : "Cassa",
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
                                        onClick={() => {
                                          setMovementKind(item.kind);
                                          setMovementAccount(item.account);
                                          setEditing(item);
                                          setDocumentItem(null);
                                        }}
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
                      Il movimento è già salvato. I documenti sono visibili solo
                      agli amministratori. PDF, JPG e PNG fino a 3 MB.
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
                          Uscite {money(b.expense)} · Differenza{" "}
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
                {!memberEdit && (
                  <p>
                    Per abilitare un nuovo utente, chiedigli di compilare
                    “Richiedi accesso” dalla pagina di login e approva la
                    richiesta.
                  </p>
                )}
                {memberEdit && (
                  <form
                    key={memberEdit.user_id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      void run(async () => {
                        await post("members", {
                          ...form,
                          active: form.active === "true",
                          ...(memberEdit
                            ? { user_id: memberEdit.user_id }
                            : {}),
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
                        Nome utente
                        <input
                          name="username"
                          required
                          minLength={3}
                          maxLength={32}
                          pattern="[a-z0-9][a-z0-9._-]{2,31}"
                          defaultValue={memberEdit.username ?? ""}
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
                      La password viene scelta dall’utente tramite il
                      collegamento ricevuto via email.
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
                )}
                <ul className="soci-members">
                  {members.map((m) => (
                    <li key={m.user_id}>
                      <div>
                        <strong>{m.name}</strong>
                        <small>
                          {m.email} · {m.username ?? "Nome utente da assegnare"}{" "}
                          · {roleLabels[m.role]} ·{" "}
                          {m.active
                            ? m.activated_at
                              ? "Attivo"
                              : "Invito in attesa"
                            : "Disattivato"}
                        </small>
                      </div>
                      <div className="soci-actions">
                        <button onClick={() => setMemberEdit(m)}>
                          Gestisci
                        </button>
                        <button
                          disabled={busy || !m.active || !m.username}
                          onClick={() =>
                            void run(async () => {
                              await api("access/resend", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ user_id: m.user_id }),
                              });
                              setMessage(
                                "Collegamento per la password inviato.",
                              );
                            })
                          }
                        >
                          {m.activated_at
                            ? "Invia recupero password"
                            : "Reinvia invito"}
                        </button>
                      </div>
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
