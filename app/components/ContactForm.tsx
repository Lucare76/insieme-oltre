"use client";

import { useRef, useState, type FormEvent } from "react";
import { contactRoles } from "../../lib/contact";

export function ContactForm({ available, privacyHref }: { available: boolean; privacyHref: string }) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const sending = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!available || sending.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    sending.current = true;
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"), email: data.get("email"), phone: data.get("phone"),
          role: data.get("role"), message: data.get("message"),
          privacy: data.get("privacy") === "on", website: data.get("website"),
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      setFeedback({ error: !response.ok, message: result.message || "Invio non riuscito. Riprova più tardi." });
      if (response.ok) form.reset();
    } catch {
      setFeedback({ error: true, message: "Invio non confermato. Riprova più tardi oppure scrivici via email." });
    } finally {
      sending.current = false;
      setPending(false);
    }
  }

  return (
    <form className="contact-form" onSubmit={submit} aria-label="Parla con noi" aria-describedby="contact-note" aria-busy={pending}>
      <p className="contact-note" id="contact-note">I campi con * sono obbligatori. Non inserire dati sanitari o informazioni particolarmente sensibili nel messaggio.</p>
      <div className="contact-fields">
        <label htmlFor="contact-name">Nome e cognome *<input id="contact-name" name="name" autoComplete="name" required maxLength={120} /></label>
        <label htmlFor="contact-email">Email *<input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label htmlFor="contact-phone">Telefono (facoltativo)<input id="contact-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} pattern="[+0-9\s.\(\)\-]+" /></label>
        <label htmlFor="contact-role">Sono… *<select id="contact-role" name="role" defaultValue="" required><option value="" disabled>Seleziona un’opzione</option>{contactRoles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
        <label className="contact-wide" htmlFor="contact-message">Messaggio *<textarea id="contact-message" name="message" rows={5} required maxLength={5000} /></label>
      </div>
      <div className="contact-honeypot" aria-hidden="true"><label htmlFor="contact-website">Sito web<input id="contact-website" name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="contact-privacy" htmlFor="contact-privacy">
        <input id="contact-privacy" name="privacy" type="checkbox" required disabled={!available} />
        <span>Ho letto l’<a href={privacyHref} target="_blank" rel="noopener noreferrer">informativa sul trattamento dei dati (si apre in una nuova scheda)</a>. *</span>
      </label>
      {!available && <p className="contact-notice">Il modulo non è ancora disponibile. Nel frattempo puoi scriverci direttamente a <a href="mailto:info@insiemeoltreischia.it">info@insiemeoltreischia.it</a>.</p>}
      <button className="button button-primary" type="submit" disabled={!available || pending}>{pending ? "Invio in corso…" : "Invia il messaggio"}<span aria-hidden="true">→</span></button>
      <div aria-live="polite" aria-atomic="true">{feedback && <p className={feedback.error ? "contact-notice" : "contact-success"}>{feedback.message}</p>}</div>
      <noscript><p>Per usare il form attiva JavaScript oppure scrivici via email.</p></noscript>
    </form>
  );
}
