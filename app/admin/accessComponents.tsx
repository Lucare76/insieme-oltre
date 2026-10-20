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
  pending: "In attesa",
  processing: "Approvazione in corso",
  approved: "Approvata",
  rejected: "Rifiutata",
};
export function AccessRequests({
  api,
  onPending,
}: {
  api: (path: string, init?: RequestInit) => Promise<Response>;
  onPending: (n: number) => void;
}) {
  const [items, setItems] = useState<AccessRequest[]>([]);
  const [emailReady, setEmailReady] = useState(true);
  const [message, setMessage] = useState("Caricamento richieste…");
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  async function load(offset = 0) {
    const b = await (await api("access/requests?offset=" + offset)).json();
    setItems((old) => (offset ? [...old, ...b.items] : b.items));
    setEmailReady(b.emailReady);
    setMore(b.items.length === 100);
    if (!offset)
      onPending(
        b.items.filter((x: AccessRequest) => x.status === "pending").length,
      );
    setMessage("");
  }
  useEffect(() => {
    let active = true;
    void api("access/requests")
      .then((r) => r.json())
      .then((b) => {
        if (active) {
          setItems(b.items);
          setEmailReady(b.emailReady);
          setMore(b.items.length === 100);
          onPending(
            b.items.filter((x: AccessRequest) => x.status === "pending").length,
          );
          setMessage("");
        }
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [api, onPending]);
  async function review(id: string, action: string, role?: string) {
    setBusy(true);
    setMessage("");
    try {
      const b = await (
        await api("access/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action, role }),
        })
      ).json();
      await load();
      setMessage(
        b.warning ??
          (action === "approve"
            ? "Richiesta approvata e invito inviato."
            : "Richiesta rifiutata."),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Operazione non riuscita.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="soci-card">
      <h2>Richieste di accesso</h2>
      <p>
        Controlla chi ha richiesto l’accesso e scegli il ruolo. L’utente
        imposterà la propria password dal collegamento via email.
      </p>
      {!emailReady && (
        <p role="alert">
          Invio email non configurato: puoi esaminare le richieste, ma prima
          dell’approvazione va completata la configurazione.
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <button
        disabled={busy}
        onClick={() => void load().catch((e) => setMessage(e.message))}
      >
        Aggiorna richieste
      </button>
      <ul className="soci-members">
        {items.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <small>
                {item.email} · Nome utente: {item.username}
              </small>
              <small>
                {new Date(item.created_at).toLocaleString("it-IT")} ·{" "}
                {statusLabels[item.status]}
              </small>
              {item.status === "pending" && !item.notification_sent_at && (
                <small>
                  Notifica email all’admin non inviata: richiesta conservata
                  nel pannello.
                </small>
              )}
              {item.status === "approved" && !item.invitation_sent_at && (
                <small>
                  Invito da reinviare dalla sezione Utenti e permessi.
                </small>
              )}
            </div>
            {(item.status === "pending" || item.status === "processing") && (
              <form
                className="access-review"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  void review(item.id, "approve", String(form.get("role")));
                }}
              >
                <label>
                  Ruolo
                  <select name="role" defaultValue="member">
                    <option value="member">Socio — consultazione</option>
                    <option value="accountant">Amministratore contabile</option>
                  </select>
                </label>
                <div className="soci-actions">
                  <button className="primary" disabled={busy || !emailReady}>
                    Approva e invia invito
                  </button>
                  {item.status === "pending" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Rifiutare la richiesta di ${item.name}?`,
                          )
                        )
                          void review(item.id, "reject");
                      }}
                    >
                      Rifiuta
                    </button>
                  )}
                </div>
              </form>
            )}
          </li>
        ))}
      </ul>
      {!items.length && !message && <p>Nessuna richiesta ricevuta.</p>}
      {more && (
        <button
          disabled={busy}
          onClick={() =>
            void load(items.length).catch((e) => setMessage(e.message))
          }
        >
          Carica richieste precedenti
        </button>
      )}
    </section>
  );
}
