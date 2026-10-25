import "./whatsapp-cta.css";
export function WhatsAppCta() {
  const number = process.env.WHATSAPP_PUBLIC_NUMBER?.trim();
  if (process.env.WHATSAPP_PUBLIC_ENABLED !== "true" || !number || !/^[1-9]\d{7,14}$/.test(number)) return null;
  const text = encodeURIComponent("Ciao Insieme Oltre, vorrei avere qualche informazione.");
  return <a className="whatsapp-cta" href={"https://wa.me/" + number + "?text=" + text} target="_blank" rel="noopener noreferrer" aria-label="Scrivici su WhatsApp, si apre una nuova finestra">
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.6 7.2L4 20l1.3-4.4A8 8 0 1 1 20 11.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M8 8.5c1 3.5 3 5.5 6.5 6.5l1-2-2-1-1 1c-1.3-.6-2.3-1.6-3-3l1-1-1-2-1.5 1.5Z" fill="currentColor" /></svg>
    <span>Scrivici su WhatsApp</span>
  </a>;
}
