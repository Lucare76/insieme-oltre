"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { defaultHomeContent, type HomeContent } from "../../lib/siteContent";
import { childIssues, normalizeChildren } from "../../lib/children";
import { ChildrenEditor } from "./ChildrenEditor";
import "./admin.css";

/** Solo token di sessione Supabase: la password non viene mai salvata nel browser. */
type AdminSession = { access_token: string; refresh_token: string; expires_at: number };

const SESSION_KEY = "insieme_oltre_admin_session";
const LEGACY_TOKEN_KEY = "insieme_oltre_admin_token";
/** Rinnova il token con un minuto di anticipo sulla scadenza. */
const REFRESH_MARGIN_S = 60;
const SESSION_EXPIRED = "Sessione scaduta: accedi di nuovo.";
const SESSION_CLOSED = "Sessione chiusa.";

type Field = {
  label: string;
  path: string;
  multiline?: boolean;
};

const fields: Field[] = [
  { label: "SEO — titolo pagina", path: "meta.title" },
  { label: "SEO — descrizione", path: "meta.description", multiline: true },
  { label: "Menu — CTA", path: "nav.cta" },

  { label: "Hero — occhiello", path: "hero.eyebrow" },
  { label: "Hero — testo", path: "hero.lead", multiline: true },
  { label: "Hero — CTA principale", path: "hero.primaryCta" },
  { label: "Hero — CTA secondaria", path: "hero.secondaryCta" },
  { label: "Hero — nota scritta a mano", path: "hero.note" },
  { label: "Hero — frase logo riga 1", path: "hero.whisperLine1" },
  { label: "Hero — frase logo riga 2", path: "hero.whisperLine2" },
  { label: "Hero — frase logo evidenziata", path: "hero.whisperStrong" },

  { label: "Da dove nasce — occhiello", path: "emotionalOpening.kicker" },
  { label: "Da dove nasce — titolo riga 1", path: "emotionalOpening.titleLine1" },
  { label: "Da dove nasce — titolo riga 2", path: "emotionalOpening.titleLine2" },
  { label: "Da dove nasce — paragrafo 1", path: "emotionalOpening.paragraphs.0", multiline: true },
  { label: "Da dove nasce — paragrafo 2", path: "emotionalOpening.paragraphs.1", multiline: true },

  { label: "Manifesto — occhiello", path: "manifesto.kicker" },
  { label: "Manifesto — titolo riga 1", path: "manifesto.titleLine1" },
  { label: "Manifesto — titolo riga 2", path: "manifesto.titleLine2" },
  { label: "Manifesto — paragrafo 1", path: "manifesto.paragraphs.0", multiline: true },
  { label: "Manifesto — paragrafo 2", path: "manifesto.paragraphs.1", multiline: true },
  { label: "Manifesto — paragrafo 3", path: "manifesto.paragraphs.2", multiline: true },

  { label: "Cosa facciamo — occhiello", path: "pillars.kicker" },
  { label: "Cosa facciamo — titolo riga 1", path: "pillars.titleLine1" },
  { label: "Cosa facciamo — titolo riga 2", path: "pillars.titleLine2" },
  { label: "Cosa facciamo — introduzione", path: "pillars.intro", multiline: true },
  { label: "Card 1 — numero", path: "pillars.items.0.number" },
  { label: "Card 1 — titolo", path: "pillars.items.0.title" },
  { label: "Card 1 — testo", path: "pillars.items.0.text", multiline: true },
  { label: "Card 2 — numero", path: "pillars.items.1.number" },
  { label: "Card 2 — titolo", path: "pillars.items.1.title" },
  { label: "Card 2 — testo", path: "pillars.items.1.text", multiline: true },
  { label: "Card 3 — numero", path: "pillars.items.2.number" },
  { label: "Card 3 — titolo", path: "pillars.items.2.title" },
  { label: "Card 3 — testo", path: "pillars.items.2.text", multiline: true },
  { label: "Card 4 — numero", path: "pillars.items.3.number" },
  { label: "Card 4 — titolo", path: "pillars.items.3.title" },
  { label: "Card 4 — testo", path: "pillars.items.3.text", multiline: true },

  { label: "Aurora — sottotitolo della storia", path: "auroraStory.subtitle" },
  { label: "Storia di Aurora — paragrafo 1", path: "auroraStory.paragraphs.0", multiline: true },
  { label: "Storia di Aurora — paragrafo 2", path: "auroraStory.paragraphs.1", multiline: true },
  { label: "Storia di Aurora — paragrafo 3", path: "auroraStory.paragraphs.2", multiline: true },
  { label: "Storia di Aurora — paragrafo 4", path: "auroraStory.paragraphs.3", multiline: true },
  { label: "Storia di Aurora — paragrafo 5", path: "auroraStory.paragraphs.4", multiline: true },
  { label: "Storia di Aurora — paragrafo 6", path: "auroraStory.paragraphs.5", multiline: true },
  { label: "Storia di Aurora — chiusura", path: "auroraStory.paragraphs.6", multiline: true },
  { label: "Aurora — frase sotto la foto, riga 1", path: "auroraStory.pauseLine1" },
  { label: "Aurora — frase sotto la foto, riga 2", path: "auroraStory.pauseLine2" },
  { label: "Genitori — titolo", path: "auroraStory.parentsTitle", multiline: true },
  { label: "Genitori — paragrafo 1", path: "auroraStory.parentsParagraphs.0", multiline: true },
  { label: "Genitori — paragrafo 2", path: "auroraStory.parentsParagraphs.1", multiline: true },
  { label: "Genitori — frase in evidenza", path: "auroraStory.parentsParagraphs.2", multiline: true },
  { label: "Genitori — chiusura", path: "auroraStory.parentsParagraphs.3", multiline: true },

  { label: "Storie — occhiello", path: "stories.kicker" },
  { label: "Storie — titolo riga 1", path: "stories.titleLine1" },
  { label: "Storie — titolo riga 2", path: "stories.titleLine2" },

  { label: "Numeri — etichetta", path: "numbers.label" },
  { label: "Numeri — titolo riga 1", path: "numbers.titleLine1" },
  { label: "Numeri — titolo riga 2", path: "numbers.titleLine2" },
  { label: "Numeri — testo", path: "numbers.text", multiline: true },

  { label: "Promise — occhiello", path: "promise.kicker" },
  { label: "Promise — titolo riga 1", path: "promise.titleLine1" },
  { label: "Promise — titolo riga 2", path: "promise.titleLine2" },
  { label: "Promise — frase evidenziata", path: "promise.accent" },
  { label: "Promise — nota", path: "promise.note", multiline: true },

  { label: "Finale — occhiello", path: "join.kicker" },
  { label: "Finale — titolo riga 1", path: "join.titleLine1" },
  { label: "Finale — titolo riga 2", path: "join.titleLine2" },
  { label: "Finale — testo", path: "join.text", multiline: true },
  { label: "Finale — CTA", path: "join.cta" },

  { label: "Footer — brand", path: "footer.brand" },
  { label: "Footer — nota", path: "footer.note" },
  { label: "Footer — torna su", path: "footer.backTop" },
];

function getValue(obj: unknown, path: string): string {
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return "";
    return (acc as Record<string, unknown>)[key];
  }, obj);

  return typeof value === "string" ? value : "";
}

function setValue<T extends Record<string, unknown>>(obj: T, path: string, value: string): T {
  const clone = structuredClone(obj);
  const keys = path.split(".");
  let current: Record<string, unknown> = clone;

  keys.slice(0, -1).forEach((key, index) => {
    const nextKey = keys[index + 1];
    current[key] = current[key] ?? (/^\d+$/.test(nextKey) ? [] : {});
    current = current[key] as Record<string, unknown>;
  });

  current[keys[keys.length - 1]] = value;
  return clone;
}

function isSession(value: unknown): value is AdminSession {
  const candidate = value as Partial<AdminSession> | null;
  return Boolean(
    candidate &&
      typeof candidate.access_token === "string" &&
      typeof candidate.refresh_token === "string" &&
      typeof candidate.expires_at === "number",
  );
}

function readStoredSession(): AdminSession | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? "null");
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function storeSession(session: AdminSession | null) {
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Senza localStorage la sessione dura finché la pagina resta aperta.
  }
}

export default function AdminPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const sessionRef = useRef<AdminSession | null>(null);
  const refreshRef = useRef<Promise<AdminSession | null> | null>(null);
  const [content, setContent] = useState<HomeContent>(defaultHomeContent);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonDraft, setJsonDraft] = useState(JSON.stringify(defaultHomeContent, null, 2));
  const [status, setStatus] = useState("Pronto");
  const [loading, setLoading] = useState(false);

  const endSession = useCallback((message: string) => {
    sessionRef.current = null;
    storeSession(null);
    setSignedIn(false);
    setStatus(message);
  }, []);

  /** Un solo rinnovo alla volta, anche se più richieste trovano il token scaduto insieme. */
  const refreshSession = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return Promise.resolve(null);

    refreshRef.current ??= fetch("/api/admin/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    })
      .then(async (response) => {
        const payload = response.ok ? await response.json().catch(() => null) : null;
        const next = isSession(payload?.session) ? payload.session : null;
        sessionRef.current = next;
        storeSession(next);
        return next;
      })
      .catch(() => null)
      .finally(() => {
        refreshRef.current = null;
      });

    return refreshRef.current;
  }, []);

  /** API admin con token valido: se il server lo rifiuta prova un rinnovo, altrimenti chiude la sessione. */
  const adminFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const send = (session: AdminSession) =>
        fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${session.access_token}` } });

      let session = sessionRef.current;
      if (session && session.expires_at - REFRESH_MARGIN_S <= Date.now() / 1000) session = await refreshSession();
      if (!session) {
        endSession(SESSION_EXPIRED);
        return null;
      }

      let response = await send(session);
      if (response.status === 401) {
        session = await refreshSession();
        if (session) response = await send(session);
      }
      if (!session || response.status === 401) {
        endSession(SESSION_EXPIRED);
        return null;
      }
      return response;
    },
    [endSession, refreshSession],
  );

  useEffect(() => {
    try {
      // Il vecchio token del magic link non è rinnovabile: si rientra con utente e password.
      window.localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {}
    sessionRef.current = readStoredSession();
    queueMicrotask(() => {
      setSignedIn(Boolean(sessionRef.current));
      setSessionChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!signedIn) return;

    async function loadContent() {
      setLoading(true);
      setStatus("Carico i testi…");

      const response = await adminFetch("/api/admin/home-content");
      setLoading(false);
      if (!response) return;

      if (!response.ok) {
        setStatus("Caricamento non riuscito: riprova tra poco.");
        return;
      }

      const payload = await response.json();
      setContent(payload.content);
      setJsonDraft(JSON.stringify(payload.content, null, 2));
      setStatus(payload.configured ? "Testi caricati." : "Supabase non è ancora configurato: vedo i testi base.");
    }

    loadContent();
  }, [signedIn, adminFetch]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signingIn) return;

    if (!username.trim() || !password) {
      setLoginError("Inserisci utente e password.");
      return;
    }

    setSigningIn(true);
    setLoginError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const payload = await response.json().catch(() => null);

      if (response.ok && isSession(payload?.session)) {
        sessionRef.current = payload.session;
        storeSession(payload.session);
        setPassword("");
        setShowPassword(false);
        setSignedIn(true);
        return;
      }

      setLoginError(
        response.status === 401
          ? "Utente o password non corretti."
          : response.status === 503
            ? "Accesso non ancora configurato sul server."
            : "Accesso non riuscito: riprova tra poco.",
      );
    } catch {
      setLoginError("Connessione non riuscita: controlla la rete e riprova.");
    } finally {
      setSigningIn(false);
    }
  }

  async function saveContent() {
    if (!signedIn) return;

    let value: HomeContent = content;

    if (jsonMode) {
      try {
        value = JSON.parse(jsonDraft) as HomeContent;
      } catch {
        setStatus("JSON non valido: correggi prima di salvare.");
        return;
      }
    }

    const children = normalizeChildren(value.children) ?? [];
    const errorCount = children.flatMap((child) => childIssues(child, children)).filter((issue) => issue.level === "error").length;
    if (errorCount) {
      const what = errorCount === 1 ? "C’è 1 errore" : `Ci sono ${errorCount} errori`;
      setStatus(`${what} da correggere in «Bambini e storie»: i bambini con errori sono segnati in rosso.`);
      return;
    }

    setLoading(true);
    setStatus("Salvo…");

    const response = await adminFetch("/api/admin/home-content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });

    setLoading(false);
    if (!response) return;

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = typeof payload?.detail === "string" ? ` (${payload.detail.slice(0, 240)})` : "";
      setStatus(`${payload?.error ?? "Salvataggio non riuscito."}${detail}`);
      return;
    }

    // Si mostra ciò che Supabase ha davvero salvato (es. campi protetti riscritti dal server), non la copia locale.
    if (!payload?.verified || !payload.content || typeof payload.content !== "object") {
      setStatus("Salvataggio non verificato: ricarica la pagina e controlla i testi.");
      return;
    }

    const saved = payload.content as HomeContent;
    setContent(saved);
    setJsonDraft(JSON.stringify(saved, null, 2));
    setStatus("Salvato e verificato su Supabase.");
  }

  /** Cambia editor senza perdere modifiche: il JSON nasce dal contenuto corrente e, al ritorno, lo sostituisce. */
  function toggleEditor() {
    if (!jsonMode) {
      setJsonDraft(JSON.stringify(content, null, 2));
      setJsonMode(true);
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonDraft);
    } catch {
      setStatus("JSON non valido: correggilo prima di tornare all’editor semplice.");
      return;
    }

    const candidate = parsed as Partial<HomeContent> | null;
    if (!candidate || typeof candidate !== "object" || !candidate.hero || !candidate.footer) {
      setStatus("JSON non valido: mancano le sezioni «hero» o «footer».");
      return;
    }
    const children = normalizeChildren(candidate.children);
    if (!children) {
      setStatus("JSON non valido: l’elenco «children» manca o non è corretto.");
      return;
    }

    setContent({ ...(candidate as HomeContent), children });
    setJsonMode(false);
    setStatus("Modifiche JSON applicate all’editor semplice (non ancora salvate).");
  }

  function logout() {
    const session = sessionRef.current;
    // Revoca anche su Supabase, così il refresh token salvato non è più utilizzabile.
    if (session) {
      fetch("/api/admin/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => undefined);
    }
    endSession(SESSION_CLOSED);
  }

  if (!sessionChecked) {
    return <main className="admin-page" />;
  }

  if (!signedIn) {
    return (
      <main className="admin-page admin-login-page">
        <form className="admin-card admin-login" onSubmit={signIn} noValidate>
          <div className="admin-heading">
            <p>Insieme Oltre</p>
            <h1>Area riservata</h1>
          </div>

          <label>
            Utente
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={signingIn}
              autoFocus
            />
          </label>

          <div className="admin-password">
            <label>
              Password
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={signingIn}
              />
            </label>
            <button
              type="button"
              className="admin-password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Nascondi password" : "Mostra password"}
            >
              {showPassword ? "Nascondi" : "Mostra"}
            </button>
          </div>

          <p className="admin-login-error" role="alert">{loginError}</p>

          <button type="submit" disabled={signingIn}>{signingIn ? "Accesso…" : "Accedi"}</button>
          {status === SESSION_EXPIRED || status === SESSION_CLOSED ? <small>{status}</small> : null}
        </form>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <section className="admin-shell">
        <div className="admin-heading">
          <p>Insieme Oltre</p>
          <h1>Pannello testi</h1>
          <span>{status}</span>
        </div>

        <div className="admin-card admin-editor">
          <div className="admin-toolbar">
            <button disabled={loading} onClick={saveContent}>Salva testi</button>
            <button type="button" className="secondary" onClick={toggleEditor}>
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
              <ChildrenEditor items={content.children} onChange={(children) => setContent({ ...content, children })} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
