"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultHomeContent, type HomeContent } from "../../lib/siteContent";
import { childIssues, normalizeChildren } from "../../lib/children";
import { ChildrenEditor } from "./ChildrenEditor";
import "./admin.css";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

function tokenFromHash() {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return hash.get("access_token");
}

export default function AdminPage() {
  const [email, setEmail] = useState("");
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

    queueMicrotask(() => setToken(nextToken));
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
    if (!isConfigured || !supabaseUrl) {
      setStatus("Prima vanno configurate le variabili Supabase su Vercel.");
      return;
    }

    if (!email.trim()) {
      setStatus("Inserisci l’indirizzo email autorizzato.");
      return;
    }

    setLoading(true);
    setStatus("Invio link di accesso…");

    const redirectTo = `${window.location.origin}/admin`;
    const response = await fetch(`${supabaseUrl}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      headers: {
        apikey: anonKey ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.trim(),
        // Nessuna registrazione automatica: il link arriva solo a un account già esistente in Supabase Auth.
        // Chi può davvero modificare i testi lo decide il server con ADMIN_ALLOWED_EMAIL.
        create_user: false,
        options: {
          email_redirect_to: redirectTo,
        },
      }),
    });

    setLoading(false);

    if (response.ok) {
      setStatus("Link inviato. Controlla la tua casella email.");
      return;
    }

    setStatus("Invio link non riuscito: indirizzo non autorizzato o servizio non disponibile.");
  }

  function toggleEditorMode() {
    if (jsonMode) {
      try {
        const parsed = JSON.parse(jsonDraft) as HomeContent;
        setContent(parsed);
        setJsonMode(false);
        setStatus("Editor semplice sincronizzato con il JSON.");
      } catch {
        setStatus("JSON non valido: correggilo prima di tornare all’editor semplice.");
      }
      return;
    }

    setJsonDraft(JSON.stringify(content, null, 2));
    setJsonMode(true);
    setStatus("Editor JSON sincronizzato con le modifiche correnti.");
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

    const children = normalizeChildren(value.children) ?? [];
    const errorCount = children.flatMap((child) => childIssues(child, children)).filter((issue) => issue.level === "error").length;
    if (errorCount) {
      const what = errorCount === 1 ? "C’è 1 errore" : `Ci sono ${errorCount} errori`;
      setStatus(`${what} da correggere in «Bambini e storie»: i bambini con errori sono segnati in rosso.`);
      return;
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
      const detail = typeof payload?.detail === "string" ? ` (${payload.detail.slice(0, 240)})` : "";
      setStatus(`${payload?.error ?? "Salvataggio non riuscito."}${detail}`);
      return;
    }

    const payload = await response.json().catch(() => null);
    const persisted = payload?.content ?? value;
    setContent(persisted);
    setJsonDraft(JSON.stringify(persisted, null, 2));
    setStatus(payload?.verified
      ? "Salvato e verificato su Supabase."
      : "Salvato. Il sito pubblico leggerà i nuovi testi.");
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
            <p>Può entrare solo l’account autorizzato.</p>
            <label>
              Email
              <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
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
              <button type="button" className="secondary" onClick={toggleEditorMode}>
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
        )}
      </section>
    </main>
  );
}
