import Link from "next/link";
import { legalPages } from "../../lib/legal";

/** "Privacy Policy · Cookie Policy" nei footer: mostra solo le pagine già pubblicate. */
export function LegalLinks({ className }: { className?: string }) {
  if (!legalPages.length) return null;

  return (
    <nav className={className} aria-label="Informazioni legali">
      {legalPages.map((page, index) => (
        <span key={page.href}>
          {index > 0 && <span aria-hidden="true"> · </span>}
          <Link href={page.href}>{page.label}</Link>
        </span>
      ))}
    </nav>
  );
}
