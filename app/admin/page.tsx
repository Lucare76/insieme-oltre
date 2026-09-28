"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultHomeContent, type HomeContent } from "../../lib/siteContent";
import "./admin.css";

const allowedEmail = "luca_renna@hotmail.com";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type Field = {
  label: string;
  path: string;
  multiline?: boolean;
};

const fields: Field[] = [
  { label: "Hero — occhiello", path: "hero.eyebrow" },
  { label: "Hero — titolo riga 1", path: "hero.titleLine1" },
  { label: "Hero — titolo riga 2", path: "hero.titleLine2" },
  { label: "Hero — testo", path: "hero.lead", multiline: true },
  { label: "Hero — CTA principale", path: "hero.primaryCta" },
  { label: "Hero — CTA secondaria", path: "hero.secondaryCta" },
  { label: "Hero — nota scritta a mano", path: "hero.note" },
  { label: "Manifesto — occhiello", path: "manifesto.kicker" },
  { label: "Manifesto — titolo riga 1", path: "manifesto.titleLine1" },
  { label: "Manifesto — titolo riga 2", path: "manifesto.titleLine2" },
  { label: "Aurora — titolo", path: "aurora.title" },
  { label: "Aurora — sottotitolo", path: "aurora.subtitle" },
  { label: "Aurora — frase", path: "aurora.quote", multiline: true },
  { label: "Promise — titolo riga 1", path: "promise.titleLine1" },
  { label: "Promise — titolo riga 2", path: "promise.titleLine2" },
  { label: "Promise — frase evidenziata", path: "promise.accent" },
  { label: "Finale — titolo riga 1", path: "join.titleLine1" },
  { label: "Finale — titolo riga 2", path: "join.titleLine2" },
  { label: "Finale — testo", path: "join.text", multiline: true },
  { label: "Footer — slogan", path: "footer.slogan" },
];

function getValue(obj: unknown, path: string): string {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return "";
    return (acc as Record<string, unknown>)[key];
  }, obj) as string;
}

function setValue<T extends Record<string, unknown>>(obj: T, path: string, value: string): T {
  const clone = structuredClone(obj);
  const keys = path.split(".");
  let current: Record<string, unknown> = clone;

  keys.slice(0, -1).forEach((key) => {
    current[key] = current[key] ?? {};
    current = current[key] as Record<string, unknown>;
  });

  current[keys[keys.length - 1]] = value;
  return clone;
}

function tokenFromHash() {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return hash.get("access_token");
}

export default function AdminPage() {
  const [email, setEmail] = useState(allowedEmail);
  const [token, setToken] = useState<string | null>(null);
  const [content, setContent] = useState<HomeContent>(defaultHomeContent);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonDraft, setJsonDraft] = useState(JSON.stringify(defaultHomeContent, null, 2));
  const [status, setStatus] = useState("Pronto");
  const [loading, setLoading] = useState(false);

  const isConfigured = useMemo(() => Boolean(supabaseUrl && anonKey), []);

  useEffect(() => {
    const hashToken = tokenFromHash();
    const storedToken = window.localStorage.getItem("insieme_oltre_admin_token");
    const nextToken = hashToken ?? storedToken;

    if (hashToken) {
      window.localStorage.setItem("insieme_oltre_admin_token", hashToken);
      window.history.replaceState(null, "", "/admin");
    }

    setToken(nextToken);
  }, []);

  useEffect(() => {
    if (!token) return;

    async function loadContent() {
      setLoading(true);
      setStatus("Carico i testi…");

      const response = await fetch("/api/admin/home-content", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        setStatus("Accesso non autorizzato o sessione scaduta.");
        setLoading(false);
        return;
      }

      const payload = await response.json();
      setContent(payload.content);
      setJsonDraft(JSON.stringify(payload.content, null, 2));
      setStatus(payload.configured ? "Testi caricati." : "Supabase non è ancora configurato: vedo i testi base.");
      setLoading(false);
    }

    loadContent();
  }, [token]);

  async function sendMagicLink() {
    if (!isConfigured) {
      setStatus("Prima vanno configurate le variabili Supabase su Vercel.");
      return;
    }

    if (email.toLowerCase() !== allowedEmail) {
      setStatus("Questo pannello è riservato a Luca.");
      return;
    }

    setLoading(true);
    setStatus("Invio link di accesso…");

    const response = await fetch(`${supabaseUrl}/auth/v1/otp`, {
      method: "POST",
      headers: {
        apikey: anonKey ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        create_user: false,
        options: {
          email_redirect_to: `${window.location.origin}/admin`,
        },
      }),
    });

    setLoading(false);
    setStatus(response.ok ? "Link inviato. Controlla Hotmail." : "Invio link non riuscito: controlla Supabase Auth.");
  }

  async function saveContent() {
    if (!token) return;

    let value: HomeContent = content;

    if (jsonMode) {
      try {
        value = JSON.parse(jsonDraft) as HomeContent;
      } catch {
        setStatus("JSON non valido: correggi prima di salvare.");
        return;
      }
    }

    setLoading(true);
    setStatus("Salvo…");

    const response = await fetch("/api/admin/home-content", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value }),
    });

    setLoading(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setStatus(payload?.error ?? "Salvataggio non riuscito.");
      return;
    }

    setContent(value);
    setJsonDraft(JSON.stringify(value, null, 2));
    setStatus("Salvato. Il sito pubblico leggerà i nuovi testi.");
  }

  function logout() {
    window.localStorage.removeItem("insieme_oltre_admin_token");
    setToken(null);
    setStatus("Sessione chiusa.");
  }

  return (
    <main className="admin-page">
      <section className="admin-shell">
        <div className="admin-heading">
          <p>Insieme Oltre</p>
          <h1>Pannello testi</h1>
          <span>{status}</span>
        </div>

        {!token ? (
          <div className="admin-card">
            <h2>Accesso riservato</h2>
            <p>Può entrare solo l’account autorizzato: {allowedEmail}</p>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <button disabled={loading} onClick={sendMagicLink}>Invia link di accesso</button>
            {!isConfigured && (
              <small>
                Mancano le variabili Supabase. Il pannello è pronto, ma va collegato prima di salvare online.
              </small>
            )}
          </div>
        ) : (
          <div className="admin-card admin-editor">
            <div className="admin-toolbar">
              <button disabled={loading} onClick={saveContent}>Salva testi</button>
              <button type="button" className="secondary" onClick={() => setJsonMode(!jsonMode)}>
                {jsonMode ? "Editor semplice" : "Editor avanzato JSON"}
              </button>
              <button type="button" className="secondary" onClick={logout}>Esci</button>
            </div>

            {jsonMode ? (
              <label>
                JSON completo
                <textarea
                  className="json-editor"
                  value={jsonDraft}
                  onChange={(event) => setJsonDraft(event.target.value)}
                />
              </label>
            ) : (
              <div className="admin-grid">
                {fields.map((field) => (
                  <label key={field.path}>
                    {field.label}
                    {field.multiline ? (
                      <textarea
                        value={getValue(content, field.path)}
                        onChange={(event) => setContent(setValue(content, field.path, event.target.value))}
                      />
                    ) : (
                      <input
                        value={getValue(content, field.path)}
                        onChange={(event) => setContent(setValue(content, field.path, event.target.value))}
                      />
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
