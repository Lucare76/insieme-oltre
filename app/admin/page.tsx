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

  { label: "Aurora — testo nella scheda", path: "stories.items.0.line" },
  { label: "Aurora — presentazione nella scheda", path: "auroraStory.cardDescription", multiline: true },
  { label: "Aurora — testo del link", path: "auroraStory.cardLink" },
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

  { label: "Emanuele — titolo della storia", path: "emanueleStory.title" },
  { label: "Emanuele — estratto nella scheda", path: "emanueleStory.cardDescription", multiline: true },
  { label: "Emanuele — testo del link", path: "emanueleStory.cardLink" },
  ...defaultHomeContent.emanueleStory.paragraphs.map((_, index, all) => ({
    label: index === all.length - 1 ? "Storia di Emanuele — chiusura" : `Storia di Emanuele — paragrafo ${index + 1}`,
    path: `emanueleStory.paragraphs.${index}`,
    multiline: true,
  })),
  { label: "Emanuele — foto 1, apertura (facoltativa)", path: "emanueleStory.photos.0" },
  { label: "Emanuele — foto 2 (facoltativa)", path: "emanueleStory.photos.1" },
  { label: "Emanuele — foto 3 (facoltativa)", path: "emanueleStory.photos.2" },

  { label: "Storie — occhiello", path: "stories.kicker" },
  { label: "Storie — titolo riga 1", path: "stories.titleLine1" },
  { label: "Storie — titolo riga 2", path: "stories.titleLine2" },
  { label: "Storie — testo in arrivo", path: "stories.comingSoon" },

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

const storyAccents = ["coral", "sage", "gold"] as const;

export default function AdminPage() {
  const [email, setEmail] = useState(allowedEmail);
  const [token, setToken] = useState<string | null>(null);
  const [content, setContent] = useState<HomeContent>(defaultHomeContent);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonDraft, setJsonDraft] = useState(JSON.stringify(defaultHomeContent, null, 2));
  const [status, setStatus] = useState("Pronto");
  const [loading, setLoading] = useState(false);

  const isConfigured = useMemo(() => Boolean(supabaseUrl && anonKey), []);

  function addStory() {
    setContent((previous) => ({
      ...previous,
      stories: {
        ...previous.stories,
        items: [...previous.stories.items, { name: "", line: "", accent: storyAccents[previous.stories.items.length % 3] }],
      },
    }));
  }

  function removeStory(index: number) {
    if (index === 0) return;
    setContent((previous) => ({
      ...previous,
      stories: { ...previous.stories, items: previous.stories.items.filter((_, itemIndex) => itemIndex !== index) },
    }));
  }

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

    if (email.toLowerCase() !== allowedEmail) {
      setStatus("Questo pannello è riservato a Luca.");
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
        email,
        create_user: true,
        options: {
          email_redirect_to: redirectTo,
        },
      }),
    });

    setLoading(false);

    if (response.ok) {
      setStatus("Link inviato. Controlla Hotmail.");
      return;
    }

    const detail = await response.text().catch(() => "");
    setStatus(`Invio link non riuscito: ${detail || "controlla Supabase Auth."}`);
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
                <section className="admin-stories" aria-labelledby="admin-stories-title">
                  <div className="admin-stories-heading">
                    <h2 id="admin-stories-title">Persone e storie</h2>
                    <button type="button" onClick={addStory}>Aggiungi un nome</button>
                  </div>
                  <div className="admin-stories-list">
                    {content.stories.items.map((story, index) => (
                      <div className="admin-story" key={index}>
                        <label>
                          Nome {index + 1}
                          <input value={story.name} disabled={index === 0}
                            onChange={(event) => setContent(setValue(content, `stories.items.${index}.name`, event.target.value))} />
                        </label>
                        <label>
                          {index === 0 ? "Frase di Aurora" : "Breve presentazione (facoltativa)"}
                          <textarea value={story.line}
                            onChange={(event) => setContent(setValue(content, `stories.items.${index}.line`, event.target.value))} />
                        </label>
                        <label>
                          Foto (facoltativa, percorso nella cartella public)
                          <input value={story.photo ?? ""} placeholder="/storie/nome.jpg"
                            onChange={(event) => setContent(setValue(content, `stories.items.${index}.photo`, event.target.value))} />
                        </label>
                        {index > 0 && <button type="button" className="secondary" onClick={() => removeStory(index)}>Rimuovi</button>}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
