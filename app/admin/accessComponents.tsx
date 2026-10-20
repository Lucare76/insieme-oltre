"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export function AccessForms() {
  const [mode, setMode] = useState<"request" | "recover" | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="access-forms">
      <div className="soci-actions">
        <button
          type="button"
          onClick={() => {
            setMode("request");
            setMessage("");
          }}
        >
          Richiedi accesso
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("recover");
            setMessage("");
          }}
        >
          Password dimenticata?
        </button>
      </div>
      {mode && (
        <form
          key={mode}
          className="soci-card"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = Object.fromEntries(new FormData(e.currentTarget));
            setBusy(true);
            setMessage("");
            try {
              const res = await fetch("/api/accesso/" + mode, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...form,
                  privacy: form.privacy === "on",
                }),
              });
              const b = await res.json();
              if (!res.ok) throw new Error(b.error);
              setMessage(b.message);
              setMode(null);
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Operazione non riuscita.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>
            {mode === "request"
              ? "Richiedi accesso all’associazione"
              : "Recupera la password"}
          </h3>
          {mode === "request" && (
            <>
              <p>
                L’admin esaminerà la richiesta e assegnerà il ruolo. Fino
                all’approvazione non potrai accedere.
              </p>
              <label>
                Nome e cognome
                <input
                  name="name"
                  minLength={2}
                  maxLength={120}
                  required
                  autoComplete="name"
                />
              </label>
              <label>
                Nome utente
                <input
                  name="username"
                  minLength={3}
                  maxLength={32}
                  pattern="[a-z0-9][a-z0-9._-]{2,31}"
                  required
                  autoCapitalize="none"
                  autoComplete="username"
                />
                <small>
                  Da 3 a 32 caratteri: lettere minuscole, numeri, punto,
                  trattino e underscore.
                </small>
              </label>
              <label className="access-honeypot" aria-hidden="true">
                Lascia vuoto
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </>
          )}
          <label>
            Email
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
            />
          </label>
          {mode === "request" && (
            <label className="soci-check">
              <input name="privacy" type="checkbox" required />
              <span>
                Ho letto l’
                <Link href="/informativa-accessi" target="_blank">
                  informativa per l’area riservata
                </Link>
                .
              </span>
            </label>
          )}
          <div className="soci-actions">
            <button className="primary" disabled={busy}>
              {busy
                ? "Invio…"
                : mode === "request"
                  ? "Invia richiesta"
                  : "Invia collegamento"}
            </button>
            <button type="button" onClick={() => setMode(null)}>
              Chiudi
            </button>
          </div>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
type AccessRequest = {
  id: string;
  name: string;
  email: string;
  username: string;
  status: "pending" | "processing" | "approved" | "rejected";
  created_at: string;
  notification_sent_at: string | null;
  invitation_sent_at: string | null;
  reviewed_at: string | null;
};
const statusLabels = {
  pending: "Da approvare",
  processing: "In elaborazione",
  approved: "Accesso approvato",
  rejected: "Richiesta rifiutata",
};
type AccessApi = (path: string, init?: RequestInit) => Promise<Response>;
function AccessIcon({
  name,
}: {
  name: "bell" | "mail" | "clock" | "refresh" | "check" | "shield" | "users";
}) {
  const paths = {
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
    mail: "M3 5h18v14H3zM3 5l9 8 9-8",
    clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3 2",
    refresh: "M20 7a9 9 0 1 0 1 8M20 3v5h-5",
    check: "M5 12l4 4L19 6",
    shield: "M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6",
    users:
      "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M17 4a4 4 0 0 1 0 8M22 21v-3a4 4 0 0 0-3-4",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
function RequestCard({
  item,
  busy,
  emailReady,
  onReview,
  onNotify,
}: {
  item: AccessRequest;
  busy: boolean;
  emailReady: boolean;
  onReview: (id: string, action: string, role?: string) => void;
  onNotify: (id: string) => void;
}) {
  const [role, setRole] = useState("member");
  const pending = item.status === "pending" || item.status === "processing";
  const initials = item.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
  const date = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(item.created_at));
  return (
    <article className={`access-request-card access-state-${item.status}`}>
      <div className="access-person">
        <div className="access-person-heading">
          <div className="access-avatar" aria-hidden="true">
            {initials}
          </div>
          <div>
            <span className={`access-status access-status-${item.status}`}>
              <span />
              {statusLabels[item.status]}
            </span>
            <h3>{item.name}</h3>
          </div>
        </div>
        <dl className="access-details">
          <div>
            <dt>
              <AccessIcon name="mail" /> Email
            </dt>
            <dd>{item.email}</dd>
          </div>
          <div>
            <dt>
              <AccessIcon name="users" /> Nome utente
            </dt>
            <dd>{item.username}</dd>
          </div>
          <div>
            <dt>
              <AccessIcon name="clock" /> Richiesta ricevuta
            </dt>
            <dd>{date}</dd>
          </div>
        </dl>
        <div
          className={`access-mail-status ${item.notification_sent_at ? "is-sent" : "is-unsent"}`}
        >
          <AccessIcon name={item.notification_sent_at ? "check" : "bell"} />
          <span>
            {item.notification_sent_at
              ? "Avviso email inviato all’admin"
              : "Avviso email non ancora inviato"}
          </span>
          {pending && (
            <button
              type="button"
              disabled={busy || !emailReady}
              onClick={() => onNotify(item.id)}
            >
              {item.notification_sent_at ? "Reinvia avviso" : "Invia avviso"}
            </button>
          )}
        </div>
        {item.status === "approved" && !item.invitation_sent_at && (
          <p className="access-invite-warning">
            Invito da reinviare dalla sezione Utenti e permessi.
          </p>
        )}
      </div>
      {pending ? (
        <form
          className="access-decision"
          onSubmit={(e) => {
            e.preventDefault();
            onReview(item.id, "approve", role);
          }}
        >
          <div className="access-decision-title">
            <AccessIcon name="shield" />
            <strong>Abilita l’accesso</strong>
          </div>
          <p>Scegli cosa potrà vedere e gestire questa persona.</p>
          <label htmlFor={`role-${item.id}`}>Ruolo da assegnare</label>
          <select
            id={`role-${item.id}`}
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={busy}
          >
            <option value="member">Socio — consultazione</option>
            <option value="accountant">Amministratore contabile</option>
          </select>
          <p className="access-role-help">
            {role === "member"
              ? "Può consultare entrate, uscite e saldi. Non può modificare i conti."
              : "Può registrare e correggere i movimenti e gestire i giustificativi."}
          </p>
          <button
            className="primary access-approve"
            disabled={busy || !emailReady}
          >
            <AccessIcon name="check" />
            {busy ? "Operazione in corso…" : "Approva e invia invito"}
          </button>
          {item.status === "pending" && (
            <button
              className="access-reject"
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Rifiutare la richiesta di ${item.name}?`))
                  onReview(item.id, "reject");
              }}
            >
              Rifiuta richiesta
            </button>
          )}
          <small>La password sarà scelta dall’utente tramite email.</small>
        </form>
      ) : (
        <div className="access-completed">
          <AccessIcon name={item.status === "approved" ? "check" : "shield"} />
          <strong>{statusLabels[item.status]}</strong>
          <p>
            {item.status === "approved"
              ? "L’utente potrà impostare la password dal collegamento ricevuto."
              : "Non è stato abilitato alcun accesso."}
          </p>
        </div>
      )}
    </article>
  );
}
export function AccessRequests({
  api,
  onPending,
}: {
  api: AccessApi;
  onPending: (n: number) => void;
}) {
  const [items, setItems] = useState<AccessRequest[]>([]);
  const [emailReady, setEmailReady] = useState(true);
  const [notificationEmail, setNotificationEmail] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [more, setMore] = useState(false);
  const [filter, setFilter] = useState("pending");
  async function load(offset = 0) {
    const b = await (await api("access/requests?offset=" + offset)).json();
    setItems((old) => (offset ? [...old, ...b.items] : b.items));
    setEmailReady(b.emailReady);
    setNotificationEmail(b.notificationEmail ?? "");
    setMore(b.items.length === 100);
    setLoaded(true);
    if (!offset)
      onPending(
        b.items.filter((x: AccessRequest) => x.status === "pending").length,
      );
  }
  useEffect(() => {
    let active = true;
    async function fetchItems() {
      try {
        const b = await (await api("access/requests")).json();
        if (active) {
          setItems(b.items);
          setEmailReady(b.emailReady);
          setNotificationEmail(b.notificationEmail ?? "");
          setMore(b.items.length === 100);
          setLoaded(true);
          onPending(
            b.items.filter((x: AccessRequest) => x.status === "pending").length,
          );
        }
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Caricamento non riuscito.",
          );
          setFailed(true);
          setLoaded(true);
        }
      }
    }
    void fetchItems();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void fetchItems();
    }, 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [api, onPending]);
  async function action(work: () => Promise<string>) {
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      setMessage(await work());
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof Error ? error.message : "Operazione non riuscita.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function post(path: string, body: unknown = {}) {
    return (
      await api("access/" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    ).json();
  }
  function review(id: string, kind: string, role?: string) {
    void action(async () => {
      const b = await post("review", { id, action: kind, role });
      await load();
      return (
        b.warning ??
        (kind === "approve"
          ? "Richiesta approvata e invito inviato."
          : "Richiesta rifiutata.")
      );
    });
  }
  function notify(id: string) {
    void action(async () => {
      const b = await post("notify-request", { id });
      await load();
      return b.message;
    });
  }
  const todo = items.filter((x) =>
    ["pending", "processing"].includes(x.status),
  ).length;
  const visible = items.filter(
    (item) =>
      filter === "all" ||
      (filter === "pending"
        ? ["pending", "processing"].includes(item.status)
        : item.status === filter),
  );
  const filters = [
    { id: "pending", label: "Da gestire", count: todo },
    { id: "all", label: "Tutte", count: items.length },
    {
      id: "approved",
      label: "Approvate",
      count: items.filter((x) => x.status === "approved").length,
    },
    {
      id: "rejected",
      label: "Rifiutate",
      count: items.filter((x) => x.status === "rejected").length,
    },
  ];
  return (
    <section className="access-inbox" aria-labelledby="access-title">
      <header className="access-inbox-heading">
        <div>
          <p className="soci-kicker">Accessi e permessi</p>
          <h2 id="access-title">
            Richieste di accesso{" "}
            {loaded && todo > 0 && (
              <span className="access-title-count">{todo}</span>
            )}
          </h2>
          <p>
            Accogli le nuove persone nell’associazione.
            <br />
            Controlla la richiesta e scegli il ruolo prima di abilitare
            l’accesso.
          </p>
        </div>
        <button
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await load();
              return "Elenco aggiornato.";
            })
          }
        >
          <AccessIcon name="refresh" /> Aggiorna richieste
        </button>
      </header>
      <div
        className={`access-email-banner ${!emailReady ? "access-email-warning" : ""}`}
      >
        <div className="access-email-icon">
          <AccessIcon name="bell" />
        </div>
        <div>
          <strong>
            {emailReady
              ? "Un’email per ogni nuova richiesta"
              : "Avvisi email da configurare"}
          </strong>
          <p>
            {emailReady ? (
              <>
                Gli avvisi vengono inviati a{" "}
                <b>{notificationEmail || "l’email dell’admin"}</b>.
              </>
            ) : (
              "Verifica la chiave Brevo e il mittente nelle impostazioni del sito."
            )}
          </p>
        </div>
        <button
          disabled={busy || !emailReady || !loaded}
          onClick={() =>
            void action(async () => {
              const b = await post("notification-test");
              return b.message;
            })
          }
        >
          <AccessIcon name="mail" /> Prova email
        </button>
      </div>
      {message && (
        <p
          className={`access-feedback ${failed ? "is-error" : ""}`}
          role={failed ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      <nav className="access-filters" aria-label="Filtra richieste">
        {filters.map((f) => (
          <button
            key={f.id}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            <span>{f.count}</span>
          </button>
        ))}
      </nav>
      {!loaded ? (
        <div className="access-empty" role="status">
          <AccessIcon name="refresh" />
          <h3>Caricamento richieste…</h3>
        </div>
      ) : visible.length ? (
        <div className="access-request-list">
          {visible.map((item) => (
            <RequestCard
              key={item.id}
              item={item}
              busy={busy}
              emailReady={emailReady}
              onReview={review}
              onNotify={notify}
            />
          ))}
        </div>
      ) : (
        <div className="access-empty">
          <AccessIcon name="check" />
          <h3>
            {filter === "pending"
              ? "Tutto in ordine"
              : "Nessuna richiesta in questa sezione"}
          </h3>
          <p>
            {filter === "pending"
              ? "Non ci sono richieste da approvare. Le nuove richieste compariranno qui."
              : "Puoi scegliere un altro filtro per consultare le richieste ricevute."}
          </p>
        </div>
      )}
      {more && (
        <button
          className="access-load-more"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await load(items.length);
              return "Altre richieste caricate.";
            })
          }
        >
          Carica richieste precedenti
        </button>
      )}
    </section>
  );
}
