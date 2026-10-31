import Image from "next/image";
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
        <Image src="/social/instagram.png" alt="" width={28} height={28} />
      </a>
      <a
        href="https://www.facebook.com/profile.php?id=61595147324795"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Facebook di Insieme Oltre (si apre in una nuova scheda)"
        title="Facebook di Insieme Oltre"
      >
        <Image src="/social/facebook.png" alt="" width={28} height={28} />
      </a>
    </nav>
  );
}
