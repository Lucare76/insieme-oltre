"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  accessLabel,
  balances,
  categories,
  csvCell,
  kindLabels,
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
const ReceiptsPanel = dynamic(() => import("./ReceiptsPanel"));
const WhatsAppPanel = dynamic(() => import("./WhatsAppPanel"));
const FundraisingPanel = dynamic(() => import("./FundraisingPanel").then(m => m.FundraisingPanel));
import { AccountingDashboard } from "./AccountingDashboard";
import { MovementLedger } from "./MovementLedger";
import { AdminSidebar } from "./AdminSidebar";
import "./admin-workspace.css";
import {
  defaultMovementFilters,
  filterMovements,
} from "../../lib/movementFilters";
import { AccessForms, AccessRequests } from "./accessComponents";
type User = {
  id: string;
  name: string;
  role: AssociationRole;
  psychologist?: boolean;
};
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
  role: "member" | "accountant" | "president" | "none";
  psychologist: boolean;
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
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [tab, setTab] = useState("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contentVisited, setContentVisited] = useState(false);
  const [whatsappAllowed, setWhatsappAllowed] = useState(false);
  const [pending, setPending] = useState(0);
  const [editing, setEditing] = useState<Item | null | undefined>(undefined);
  const [filters, setFilters] = useState(defaultMovementFilters);
  const [reportYear, setReportYear] = useState(() => today().slice(0, 4));
  const [movementKind, setMovementKind] = useState("income");
  const [movementAccount, setMovementAccount] = useState("bank");
  const [members, setMembers] = useState<Member[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [memberEdit, setMemberEdit] = useState<Member | null>(null);
  const [manualInvite, setManualInvite] = useState(false);
  const [manualInviteFeedback, setManualInviteFeedback] = useState("");
  const [membersFeedback, setMembersFeedback] = useState("");
  const adminFormSubmitting = useRef(false);
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
    setWhatsappAllowed(false);
    setContentVisited(false);
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
        throw Object.assign(new Error(b.error || "Operazione non riuscita."), { status: res.status });
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
            if (data.user.role === "none") {
              router.replace("/admin/questionari");
              return;
            }
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
  }, [api, load, clear, router]);
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
  useEffect(() => {
    if (!user) return;
    let active = true;
    queueMicrotask(() => { void api("whatsapp?view=access").then(r => r.json()).then(data => {
      if (active) setWhatsappAllowed(Boolean(data.allowed));
    }).catch(() => { if (active) setWhatsappAllowed(user.role === "owner"); }); });
    return () => { active = false; };
  }, [api, user]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onEscape);
    };
  }, [mobileMenuOpen]);
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
      // Con il solo ruolo Psicologa si entra direttamente nell’area questionari.
      if (b.user.role === "none") {
        router.replace("/admin/questionari");
        return;
      }
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
  const write = user?.role === "owner" || user?.role === "accountant";
  const filtered = filterMovements(items, filters);
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
    if (value === "contents" || value === "stories") setContentVisited(true);
    setTab(value);
    await run(async () => {
      if (value === "register" || value === "fundraising") await load();
      if (value === "members")
        setMembers((await (await api("members")).json()).items);
      if (value === "audit")
        setAudit((await (await api("audit")).json()).items);
    });
  }
  function exportCsv() {
    download(
      new Blob(
        [
          "﻿" +
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
                (x.amount_cents / 100).toFixed(2).replace(".", ","),
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
    );
  }
  function editMovement(item: Item) {
    setMovementKind(item.kind);
    setMovementAccount(item.account);
    setEditing(item);
    setDocumentItem(null);
  }
  function cancelMovement(item: Item) {
    if (
      item.category === "Quote associative" &&
      !window.confirm(
        "Questo movimento potrebbe essere collegato a una quota annuale. " +
        "La rettifica annullerà sia l'entrata in Contabilità sia la quota nel Libro soci, " +
        "conservando entrambi i record nello storico. Continuare?",
      )
    ) return;
    const reason = window.prompt(
      "Motivo dell’annullamento (10–500 caratteri):",
    );
    if (reason === null) return;
    if (reason.trim().length < 10 || reason.length > 500) {
      setMessage("Indica una motivazione di almeno 10 e massimo 500 caratteri. Non è stato annullato nulla.");
      return;
    }
    void run(async () => {
      const response = await post("movements", {
        id: item.id,
        version: item.version,
        cancel_reason: reason.trim(),
      });
      const result = await response.json() as { membership_fee_cancelled?: boolean };
      try {
        await load();
        setMessage(result.membership_fee_cancelled
          ? "Quota associativa e movimento annullati. La rettifica è tracciata e il socio può registrare un nuovo versamento corretto."
          : "Movimento annullato correttamente e rimosso dai saldi.");
      } catch {
        setMessage("Annullamento salvato. Non ripetere l'operazione: aggiorna la pagina per consultare lo storico.");
      }
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
    <main className={"soci admin-area" + (tab === "whatsapp" ? " soci-whatsapp" : "")}>
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
                ? `${user.name} · ${accessLabel(user)}`
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
            <div className="admin-mobile-bar">
              <button type="button" className="admin-mobile-toggle" aria-expanded={mobileMenuOpen}
                aria-controls="admin-site-navigation" onClick={() => setMobileMenuOpen(open => !open)}>
                <span aria-hidden="true">☰</span> Menu sezioni
              </button>
              <span>{({
                home: "Dashboard", register: "Contabilità", fundraising: "Raccolte fondi",
                receipts: "Ricevute", whatsapp: "WhatsApp", requests: "Richieste di accesso",
                contents: "Contenuti del sito", stories: "Storie delle famiglie",
                members: "Utenti e permessi", audit: "Storico operazioni",
              } as Record<string, string>)[tab] || "Area riservata"}</span>
            </div>
            <div className="admin-workspace">
              <AdminSidebar
                tab={tab}
                onNavigate={(next) => { void openTab(next); }}
                role={user.role}
                psychologist={Boolean(user.psychologist)}
                canWrite={Boolean(write)}
                whatsappAllowed={whatsappAllowed}
                pending={pending}
                mobileOpen={mobileMenuOpen}
                onDismiss={() => setMobileMenuOpen(false)}
              />
              <div className="admin-main-content">
            {tab === "home" && (
              <section className="admin-home-card" aria-label="Panoramica associazione">
                <p className="admin-home-kicker">BENVENUTO NELL'AREA RISERVATA</p>
                <h2>Ciao, {user.name}</h2>
                <p>
                  {user.role === "owner"
                    ? "Tutto ciò che serve per amministrare Insieme Oltre, organizzato in un unico spazio. Seleziona un'area dalla barra laterale."
                    : user.role === "accountant"
                      ? "Gestisci conti e registrazioni dell'associazione. Le altre funzioni autorizzate sono nel menu laterale."
                      : "Consulta le risorse e le attività di Insieme Oltre, con le sezioni autorizzate nel menu laterale."}
                </p>
                <h3 className="admin-home-quick-title">ACCESSI RAPIDI</h3>
                <div className="admin-home-actions">
                  <button type="button" className="admin-home-action" onClick={() => void openTab("register")}>
                    <strong>Contabilità</strong>
                    <span>Entrate, uscite, saldi di cassa e banca</span>
                  </button>
                  <button type="button" className="admin-home-action" onClick={() => void openTab("fundraising")}>
                    <strong>Raccolte fondi</strong>
                    <span>Consegne, incassi e rendiconti delle iniziative</span>
                  </button>
                  {(user.role === "owner" || user.role === "president" || user.role === "accountant") && (
                    <Link className="admin-home-action" href="/admin/libri-sociali">
                      <strong>Libri sociali</strong>
                      <span>Soci, quote associative, volontari e verbali</span>
                    </Link>
                  )}
                  {(user.role === "owner" && pending > 0) && (
                    <button type="button" className="admin-home-action" onClick={() => void openTab("requests")}>
                      <strong>{pending} richieste da gestire</strong>
                      <span>Controlla le domande di accesso in attesa</span>
                    </button>
                  )}
                </div>
              </section>
            )}
            {contentVisited && user.role === "owner" && <div hidden={tab !== "contents" && tab !== "stories"}><ContentEditor section={tab === "stories" ? "stories" : "contents"} /></div>}
            {tab === "whatsapp" && whatsappAllowed && <WhatsAppPanel api={api} owner={user.role === "owner"} />}
            {tab === "receipts" && write && <ReceiptsPanel api={api} />}
            {tab === "fundraising" && <FundraisingPanel items={items} loaded={dataLoaded} onOpenAccounting={() => void openTab("register")} api={api} canWrite={Boolean(write)} onAccountingChange={load} />}
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
                <MovementLedger
                  items={items}
                  filtered={filtered}
                  loaded={dataLoaded}
                  write={write}
                  busy={busy}
                  years={years}
                  projects={projects}
                  filters={filters}
                  onFilters={setFilters}
                  onExport={exportCsv}
                  onEdit={editMovement}
                  onCancel={cancelMovement}
                  onDocuments={(item) => void openDocuments(item)}
                />
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
                <div className="soci-actions">
                  <button type="button" disabled={busy} onClick={() => {
                    setManualInvite(v => !v);
                    setManualInviteFeedback("");
                  }}>
                    {manualInvite ? "Chiudi invito manuale" : "Prepara invito manuale"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => void run(async () => {
                    try {
                      const response = await api("members");
                      const result = await response.json() as {items: Member[]};
                      setMembers(result.items);
                      setMembersFeedback("Elenco utenti aggiornato. " + result.items.length + " account presenti.");
                    } catch (error) {
                      setMembersFeedback(error instanceof Error ? error.message : "Aggiornamento dell'elenco non riuscito.");
                      throw error;
                    }
                  })}>Aggiorna elenco utenti</button>
                </div>
                {manualInvite && (
                  <form noValidate className="receipt-form" onSubmit={e => {
                    e.preventDefault();
                    if (adminFormSubmitting.current) return;
                    const fields = Object.fromEntries(new FormData(e.currentTarget));
                    const name = String(fields.name || "").trim();
                    const email = String(fields.email || "").trim().toLowerCase();
                    const username = String(fields.username || "").trim().toLowerCase();
                    if (name.length < 2 || name.length > 120) {
                      setManualInviteFeedback("Inserisci il nome e cognome completi della persona.");
                      return;
                    }
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                      setManualInviteFeedback("Controlla l'indirizzo email.");
                      return;
                    }
                    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
                      setManualInviteFeedback("Il nome utente deve avere 3–32 caratteri, solo minuscole, numeri, punto, trattino o underscore.");
                      return;
                    }
                    if (fields.confirm !== "on") {
                      setManualInviteFeedback("Conferma che la persona ha chiesto l'accesso e che l'email è stata verificata.");
                      return;
                    }
                    adminFormSubmitting.current = true;
                    setManualInviteFeedback("Preparazione richiesta in corso…");
                    void run(async () => {
                      try {
                        const response = await api("access/manual-request", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({name, email, username, confirm: true}),
                        });
                        const result = await response.json() as { id?: string };
                        if (!result.id) throw new Error("Esito non verificabile: controlla le richieste prima di riprovare.");
                        setManualInvite(false);
                        setManualInviteFeedback("");
                        setTab("requests");
                        setMessage("Richiesta predisposta correttamente. In Richieste di accesso scegli il ruolo e premi Approva e invia invito.");
                      } catch (error) {
                        const explanation = error instanceof Error ? error.message : "Creazione richiesta non riuscita.";
                        setManualInviteFeedback(explanation);
                      } finally {
                        adminFormSubmitting.current = false;
                      }
                    });
                  }}>
                    <h3>Nuovo invito preparato dall'amministratore</h3>
                    <p>Per una persona che ha richiesto l'accesso ma non riesce a usare il modulo pubblico. Non equivale all'ammissione nel Libro soci.</p>
                    <div className="soci-grid">
                      <label>Nome e cognome
                        <input name="name" required minLength={2} maxLength={120} autoComplete="name" />
                      </label>
                      <label>Email della persona
                        <input name="email" type="email" required maxLength={254} autoComplete="email" />
                      </label>
                      <label>Nome utente da assegnare
                        <input name="username" required minLength={3} maxLength={32} pattern="[a-z0-9][a-z0-9._-]{2,31}" autoCapitalize="none" />
                      </label>
                    </div>
                    <label className="soci-check">
                      <input type="checkbox" name="confirm" required />
                      Confermo che questa persona ha richiesto l'accesso e che l'indirizzo email è stato verificato. L'informativa sarà accettata dalla persona quando imposterà la password.
                    </label>
                    <button type="submit" className="primary" disabled={busy}>{busy ? "Preparazione…" : "Crea richiesta manuale"}</button>
                    {manualInviteFeedback && <p className="soci-message" role="status" aria-live="polite">{manualInviteFeedback}</p>}
                  </form>
                )}
                {membersFeedback && !memberEdit && <p className="soci-message" role="status" aria-live="polite">{membersFeedback}</p>}
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
                    noValidate
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = Object.fromEntries(new FormData(e.currentTarget));
                      const name = String(form.name || "").trim();
                      const username = String(form.username || "").trim().toLowerCase();
                      const email = String(form.email || "").trim().toLowerCase();
                      if (name.length < 1 || name.length > 120) {
                        setMembersFeedback("Inserisci il nome completo prima di salvare i permessi.");
                        return;
                      }
                      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        setMembersFeedback("L'email dell'account non è valida.");
                        return;
                      }
                      if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
                        setMembersFeedback("Nome utente non valido: usa da 3 a 32 caratteri minuscoli, numeri, punto, trattino o underscore.");
                        return;
                      }
                      if (form.role === "none" && form.psychologist !== "on") {
                        setMembersFeedback("Assegna almeno un permesso: per Nessun accesso contabile seleziona Psicologa.");
                        return;
                      }
                      setMembersFeedback("Salvataggio dei permessi in corso…");
                      void run(async () => {
                        try {
                          await post("members", {
                            ...form,
                            name,
                            username,
                            email,
                            psychologist: form.psychologist === "on",
                            active: form.active === "true",
                            user_id: memberEdit.user_id,
                          });
                          setMemberEdit(null);
                          setMembersFeedback("Permessi salvati. Aggiorno la lista…");
                          try {
                            const loaded = await (await api("members")).json() as {items: Member[]};
                            setMembers(loaded.items);
                            setMembersFeedback("Permessi aggiornati correttamente.");
                          } catch {
                            setMembersFeedback("Permessi salvati, ma l'elenco non è stato aggiornato. Premi Aggiorna elenco utenti prima di ripetere l'operazione.");
                          }
                        } catch (error) {
                          setMembersFeedback(error instanceof Error ? error.message : "Impossibile salvare i permessi.");
                        }
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
                          <option value="accountant">Tesoriere — contabilità e libri sociali</option>
                          <option value="president">Presidente — libri sociali</option>
                          <option value="none">
                            Nessun accesso alla contabilità
                          </option>
                        </select>
                      </label>
                      <label className="soci-check">
                        <input
                          type="checkbox"
                          name="psychologist"
                          defaultChecked={memberEdit.psychologist}
                        />
                        Psicologa — gestione dei questionari
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
                      {busy ? "Salvataggio…" : "Salva permessi"}
                    </button>
                    {membersFeedback && <p className="soci-message" role="status" aria-live="polite">{membersFeedback}</p>}
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
                          · {accessLabel(m)} ·{" "}
                          {m.active
                            ? m.activated_at
                              ? "Attivo"
                              : "Invito in attesa"
                            : "Disattivato"}
                        </small>
                      </div>
                      <div className="soci-actions">
                        <button onClick={() => {setMembersFeedback("");setMemberEdit(m);}}>
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
              </div>
            </div>
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

