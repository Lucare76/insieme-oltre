import "./social-links.css";

/** Plain links: no social embeds, external scripts or tracking. */
export function SocialLinks() {
  return (
    <nav className="social-links" aria-label="Seguici sui social">
      <span className="social-links-label">Seguici</span>
      <a
        href="https://www.instagram.com/insiemeoltreischia/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram di Insieme Oltre (si apre in una nuova scheda)"
        title="Instagram di Insieme Oltre"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
          <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="17.5" cy="6.5" r="1.15" fill="currentColor" />
        </svg>
      </a>
      <a
        href="https://www.facebook.com/profile.php?id=61595147324795"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Facebook di Insieme Oltre (si apre in una nuova scheda)"
        title="Facebook di Insieme Oltre"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M13.5 22v-9h3l.5-3.5h-3.5V7.25c0-1.02.28-1.72 1.75-1.72H17V2.4a23 23 0 0 0-2.55-.15C11.92 2.25 10 3.8 10 6.65V9.5H7V13h3v9h3.5Z" />
        </svg>
      </a>
    </nav>
  );
}
