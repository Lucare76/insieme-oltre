"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import "../../area-soci/soci.css";
export default function PasswordPage() {
  const [token, setToken] = useState<{
    token_hash: string;
    type: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token_hash = hash.get("token_hash");
    const type = hash.get("type");
    window.history.replaceState(null, "", window.location.pathname);
    queueMicrotask(() => {
      if (token_hash && ["invite", "recovery"].includes(type ?? ""))
        setToken({ token_hash, type: type! });
      else
        setMessage(
          "Collegamento non valido o incompleto. Richiedine uno nuovo dalla pagina di accesso.",
        );
    });
  }, []);
  return (
    <main className="soci">
      <div className="soci-card soci-login">
        <h1>Imposta la password</h1>
        {message && <p role="status">{message}</p>}
        {token && !done && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (f.get("password") !== f.get("confirm")) {
                setMessage("Le due password non corrispondono.");
                return;
              }
              setBusy(true);
              try {
                const r = await fetch("/api/accesso/password", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...token,
                    password: f.get("password"),
                  }),
                });
                const b = await r.json();
                if (!r.ok) throw new Error(b.error);
                setDone(true);
                setToken(null);
                setMessage(b.message);
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
            <p>Scegli una password personale di almeno 12 caratteri.</p>
            <label>
              Nuova password
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={200}
                autoComplete="new-password"
                required
              />
            </label>
            <label>
              Ripeti la password
              <input
                name="confirm"
                type="password"
                minLength={12}
                maxLength={200}
                autoComplete="new-password"
                required
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Salvataggio…" : "Salva password"}
            </button>
          </form>
        )}
        <p>
          <Link href="/admin">Torna all’accesso →</Link>
        </p>
      </div>
    </main>
  );
}
