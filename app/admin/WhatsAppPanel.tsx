"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import "./whatsapp.css";
type Api = (path: string, init?: RequestInit) => Promise<Response>;
type Conversation = { id: string; wa_id: string; contact_name: string; last_inbound_at: string | null; last_message_at: string; last_preview: string; unread_count: number; status: "open" | "assigned" | "closed"; assigned_to: string | null; version: number };
type Message = { id: string; conversation_id: string; direction: "in" | "out"; body: string; type: string; media_id: string | null; filename: string | null; sent_at: string; created_at: string; state: string; error_code: string | null };
type Member = { user_id: string; name: string; active: boolean; activated_at: string | null };
type Grant = { user_id: string; enabled: boolean };
type Inbox = { conversations: Conversation[]; has_more: boolean; connected: boolean; send_enabled: boolean; user_id: string; limit: number; usage: { reserved: number; delivered: number; uncertain: number } };
const stateLabel: Record<string, string> = { sending: "Invio in corso", accepted: "Accettato da Meta", sent: "Inviato", delivered: "Consegnato", read: "Letto", failed: "Non inviato", unknown: "Esito da verificare" };
const statusLabel = { open: "Da gestire", assigned: "In gestione", closed: "Chiusa" };
const dateLabel = (v: string) => new Date(v).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export default function WhatsAppPanel({ api, owner }: { api: Api; owner: boolean }) {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [showOperators, setShowOperators] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [notifications, setNotifications] = useState(false);
  const generation = useRef(0);
  const currentView = useRef("");
  const olderLoaded = useRef(false);
  const [supportsNotifications, setSupportsNotifications] = useState(false);
  const loaded = useRef(false);
  const unread = useRef<number | null>(null);
  const notifyRef = useRef(false);
  const sending = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const load = useCallback(async (quiet = false) => {
    if (currentView.current !== selected + ":" + offset) return;
    const ticket = ++generation.current;
    try {
      const [data, chat] = await Promise.all([
        api("whatsapp?offset=" + offset).then(r => r.json() as Promise<Inbox>),
        selected ? api("whatsapp?conversation=" + selected).then(r => r.json() as Promise<{ items: Message[]; has_more: boolean }>) : null,
      ]);
      if (ticket !== generation.current || currentView.current !== selected + ":" + offset) return;
      const count = data.conversations.reduce((sum, c) => sum + c.unread_count, 0);
      if (unread.current !== null && count > unread.current && notifyRef.current && Notification.permission === "granted") {
        try { new Notification("Insieme Oltre", { body: "C’è un nuovo messaggio WhatsApp.", tag: "insieme-oltre-whatsapp" }); } catch { /* Alcuni browser mobili richiedono un service worker. */ }
      }
      unread.current = count;
      setInbox(data);
      if (chat) {
        setMessages(current => {
          const all = new Map((quiet && olderLoaded.current ? current.filter(m => m.conversation_id === selected) : []).map(m => [m.id, m]));
          for (const m of chat.items) all.set(m.id, m);
          return [...all.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
        });
        if (!quiet || !olderLoaded.current) setHasOlder(chat.has_more);
      }
      loaded.current = true;
      if (!quiet) setError("");
    } catch (e) {
      if (ticket !== generation.current || currentView.current !== selected + ":" + offset) return;
      setError(e instanceof Error ? e.message : "Casella non disponibile.");
      if (e && typeof e === "object" && "status" in e && [401,403].includes(Number(e.status))) {
        setInbox(null); setMessages([]); setDrafts({}); setMembers([]); setGrants([]);
      }
      if (!loaded.current) setInbox(null);
    }
  }, [api, offset, selected]);
  useEffect(() => {
    currentView.current = selected + ":" + offset;
    olderLoaded.current = false;
    queueMicrotask(() => { setSupportsNotifications(typeof Notification !== "undefined"); void load(); });
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (document.visibilityState === "visible" && document.hasFocus()) {
        setNow(Date.now()); void load(true);
      }
      timer = setTimeout(tick, 30000);
    };
    timer = setTimeout(tick, 30000);
    const foreground = () => { if (document.visibilityState === "visible") { setNow(Date.now()); void load(true); } };
    document.addEventListener("visibilitychange", foreground);
    window.addEventListener("focus", foreground);
    return () => { currentView.current = ""; clearTimeout(timer); document.removeEventListener("visibilitychange", foreground); window.removeEventListener("focus", foreground); };
  }, [load, selected, offset]);
  const newestId = messages.at(-1)?.id;
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [selected, newestId]);
  const conversation = inbox?.conversations.find(c => c.id === selected);
  const draft = selected ? drafts[selected] ?? "" : "";
  const expires = conversation?.last_inbound_at ? Date.parse(conversation.last_inbound_at) + 86400000 : 0;
  const canReply = expires > now && expires - now <= 86400000;
  const mine = conversation?.assigned_to === inbox?.user_id;
  const uncertain = messages.some(m => m.direction === "out" && ["sending", "unknown"].includes(m.state));
  const blocked = !inbox?.connected || !inbox.send_enabled || !canReply || !mine || conversation?.status !== "assigned" || uncertain || inbox.usage.reserved >= inbox.limit;
  const visible = inbox?.conversations.filter(c => (filter === "all" || (filter === "unread" ? c.unread_count > 0 : c.status === filter)) &&
    (c.contact_name + " " + c.wa_id).toLocaleLowerCase("it").includes(search.toLocaleLowerCase("it"))) ?? [];
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Operazione non riuscita."); } finally { setBusy(false); }
  }
  const post = (body: unknown) => api("whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  async function manage(status: string) {
    if (!conversation) return;
    await post({ action: "manage", conversation_id: conversation.id, version: conversation.version, status });
    await load();
  }
  async function loadOperators() {
    const data = await (await api("whatsapp?view=operators")).json();
    setMembers(data.members); setGrants(data.grants);
  }
  return <section className={"wa-panel" + (selected ? " wa-chat-active" : "")} aria-label="Casella WhatsApp">
    <header className="wa-heading">
      <div><p className="soci-kicker">VICINI, ANCHE DA QUI</p><h2>WhatsApp</h2><p>Uno spazio per ascoltare e rispondere, insieme.</p></div>
      <button disabled={busy} onClick={() => void load()}>Aggiorna</button>
      {owner && <button aria-expanded={showOperators} onClick={() => void run(async () => { if (!showOperators) await loadOperators(); setShowOperators(!showOperators); })}>Operatori</button>}
    </header>
    {error && <p className="wa-alert" role="alert">{error}{!inbox && " La casella richiede la migrazione WhatsApp e la configurazione Meta."}</p>}
    {notice && <p className="wa-notice" role="status">{notice}</p>}
    {showOperators && owner && <section className="wa-operators"><h3>Chi può accedere</h3><p>Tu hai sempre accesso. Puoi abilitare al massimo altri due utenti attivi, indipendentemente dal loro ruolo in contabilità.</p>
      {!members.length && <p>Nessun altro utente attivo.</p>}
      {members.map(m => <label key={m.user_id}><input type="checkbox" checked={grants.some(g => g.user_id === m.user_id && g.enabled)} disabled={busy || ((!m.active || !m.activated_at) && !grants.some(g => g.user_id === m.user_id && g.enabled))}
        onChange={e => { const enabled = e.target.checked; void run(async () => { await post({ action: "operator", user_id: m.user_id, enabled }); await loadOperators(); }); }} />{m.name}{!m.active || !m.activated_at ? " (account non attivo)" : ""}</label>)}
    </section>}
    {inbox && <><div className="wa-summary">
      <span className={inbox.connected ? "wa-connected" : ""}>{inbox.connected ? "Meta configurato" : "Numero da collegare"}</span>
      <span>{inbox.usage.reserved} / {inbox.limit} invii nel mese · {inbox.usage.delivered} consegnati</span>
      {supportsNotifications && <button disabled={notifications} onClick={() => void run(async () => { const permission = await Notification.requestPermission(); const enabled = permission === "granted"; notifyRef.current = enabled; setNotifications(enabled); setNotice(enabled ? "Avvisi attivi mentre questa casella è aperta. Non sono notifiche a browser chiuso." : "Notifiche non abilitate dal browser."); })}>{notifications ? "Avvisi attivi" : "Attiva avvisi"}</button>}
    </div>
    {!inbox.connected && <p className="wa-notice">La casella è pronta per il collegamento. Quando avremo il numero, completeremo l’attivazione su Meta.</p>}
    {inbox.connected && !inbox.send_enabled && <p className="wa-notice">Ricezione configurata. L’invio è ancora disattivato.</p>}
    {inbox.usage.reserved >= inbox.limit * .8 && <p className="wa-alert">Stai raggiungendo il limite interno mensile. Include gli invii in attesa o con esito incerto; non è una fattura Meta.</p>}
    <div className={"wa-workspace" + (selected ? " wa-show-chat" : "")}>
      <aside className="wa-list" aria-label="Conversazioni">
        <label>Cerca nome o numero<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca nelle conversazioni caricate" /></label>
        <label>Mostra<select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Tutte</option><option value="unread">Non lette</option><option value="open">Da gestire</option><option value="assigned">In gestione</option><option value="closed">Chiuse</option>
        </select></label>
        <div className="wa-conversation-list">
          {!visible.length && <div className="wa-empty"><strong>Qui cominciano le conversazioni.</strong><p>{inbox.conversations.length ? "Nessun risultato in questa pagina." : "Quando qualcuno ci scriverà, troverai qui il suo messaggio."}</p></div>}
          {visible.map(c => <button key={c.id} className={"wa-conversation" + (c.id === selected ? " wa-selected" : "")} aria-pressed={c.id === selected} onClick={() => { setMessages([]); setSelected(c.id); setNow(Date.now()); setError(""); }}>
            <span className="wa-avatar" aria-hidden="true">{(c.contact_name || "+").slice(0, 1).toUpperCase()}</span>
            <span className="wa-conversation-copy"><strong>{c.contact_name || "+" + c.wa_id}</strong><small>{statusLabel[c.status]}{c.assigned_to === inbox.user_id ? " · Tu" : c.assigned_to ? " · Altro operatore" : ""}</small><span>{c.last_preview}</span><small>{dateLabel(c.last_message_at)}</small></span>
            {c.unread_count > 0 && <span className="wa-badge" aria-label={c.unread_count + " messaggi non letti"}>{c.unread_count}</span>}
          </button>)}
        </div>
        <div className="wa-pages"><button disabled={offset === 0 || busy} onClick={() => { setOffset(Math.max(0, offset - 50)); setSelected(null); }}>Precedenti</button><span>Pagina {offset / 50 + 1}</span><button disabled={!inbox.has_more || busy} onClick={() => { setOffset(offset + 50); setSelected(null); }}>Successive</button></div>
      </aside>
      <section className="wa-chat" aria-label="Messaggi">
        {!conversation ? <div className="wa-empty wa-welcome"><span aria-hidden="true">💬</span><h3>Un messaggio può avvicinare.</h3><p>Scegli una conversazione per leggerla e prenderla in gestione.</p></div> : <>
          <header className="wa-chat-header"><button className="wa-back" onClick={() => setSelected(null)} aria-label="Torna alle conversazioni">←</button><div><h3>{conversation.contact_name || "+" + conversation.wa_id}</h3><p>+{conversation.wa_id} · {statusLabel[conversation.status]}</p></div></header>
          <div className="wa-chat-actions">
            {conversation.assigned_to === null && <button disabled={busy} onClick={() => void run(() => manage("assigned"))}>Prendi in gestione</button>}
            {mine && <button disabled={busy} onClick={() => void run(() => manage("open"))}>Lascia disponibile</button>}
            {conversation.status !== "closed" && <button disabled={busy} onClick={() => void run(() => manage("closed"))}>Chiudi</button>}
            {conversation.status === "closed" && <button disabled={busy} onClick={() => void run(() => manage("open"))}>Riapri</button>}
            {conversation.unread_count > 0 && <button disabled={busy} onClick={() => void run(() => manage("read"))}>Segna come letta</button>}
          </div>
          <p className={"wa-window" + (!canReply ? " wa-window-closed" : "")}>{canReply ? "Puoi rispondere fino al " + dateLabel(new Date(expires).toISOString()) : "Finestra chiusa: per rispondere occorre un nuovo messaggio della persona."}</p>
          {error && <p className="wa-alert wa-chat-feedback" role="alert">{error}</p>}
          <div className="wa-messages" role="log" aria-label="Cronologia della conversazione" aria-live="polite">
            {hasOlder && messages[0] && <button disabled={busy} onClick={() => void run(async () => {
              const first = messages[0]; const data = await (await api("whatsapp?conversation=" + selected + "&before=" + encodeURIComponent(first.created_at) + "&before_id=" + first.id)).json();
              generation.current++; olderLoaded.current = true; setMessages(current => [...data.items, ...current]); setHasOlder(data.has_more);
            })}>Carica messaggi precedenti</button>}
            {messages.map(m => <article key={m.id} className={"wa-message wa-message-" + m.direction}>
              <p>{m.body}</p>
              {m.media_id && <button disabled={busy} onClick={() => void run(async () => {
                const response = await api("whatsapp/media?id=" + m.id); const url = URL.createObjectURL(await response.blob());
                const link = document.createElement("a"); link.href = url; link.download = m.filename || "allegato-whatsapp"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
              })}>Scarica {m.filename || "allegato"} (max 4 MB)</button>}
              <small>{dateLabel(m.sent_at)}{m.direction === "out" ? " · " + (stateLabel[m.state] || m.state) : ""}{m.error_code ? " · Codice " + m.error_code : ""}</small>
            </article>)}
            <div ref={bottom} />
          </div>
          {uncertain && <p className="wa-alert">Un invio è ancora in corso o da verificare. Non reinviarlo: attendi l’aggiornamento da Meta.</p>}
          {!mine && <p className="wa-notice">{conversation.assigned_to ? "Sta rispondendo un altro operatore." : "Prendi in gestione la conversazione per rispondere."}</p>}
          <form className="wa-composer" onSubmit={e => { e.preventDefault(); if (blocked || !draft.trim() || !selected || sending.current) return;
            sending.current = true; const conversationId = selected; const content = draft;
            void run(async () => {
              try {
                await post({ action: "send", conversation_id: conversationId, request_id: crypto.randomUUID(), text: content });
                setDrafts(current => ({ ...current, [conversationId]: "" })); setNotice("Messaggio accettato da Meta. La consegna sarà aggiornata nella chat.");
              } finally { await load(true); }
            }).finally(() => { sending.current = false; });
          }}>
            <label htmlFor="wa-reply">La tua risposta</label><textarea id="wa-reply" value={draft} maxLength={4096} rows={2} disabled={busy || blocked}
              onChange={e => { const value = e.target.value; setDrafts(current => ({ ...current, [selected!]: value })); }} placeholder={blocked ? "Invio non disponibile" : "Scrivi con calma…"} />
            <div><small>{draft.length}/4096 · Invio soltanto in risposta</small><button className="primary" disabled={busy || blocked || !draft.trim()}>{busy ? "Attendi…" : "Invia risposta"}</button></div>
          </form>
        </>}
      </section>
    </div><p className="wa-footnote">Aggiornamento ogni 30 secondi mentre la casella è visibile e attiva. Le bozze restano solo in questa sessione. Nessun invio automatico.</p></>}
  </section>;
}
