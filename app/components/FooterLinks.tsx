import Link from "next/link";
import { legalPages } from "../../lib/legal";

const links = [{ href: "/associazione", label: "L’associazione" }, ...legalPages];

/** "L’associazione · Privacy Policy · Cookie Policy" nei footer: le pagine legali compaiono solo se già pubblicate. */
export function FooterLinks({ className }: { className?: string }) {
  return (
    <nav className={className} aria-label="Informazioni sull’associazione">
      {links.map((page, index) => (
        <span key={page.href}>
          {index > 0 && <span aria-hidden="true"> · </span>}
          <Link href={page.href}>{page.label}</Link>
        </span>
      ))}
    </nav>
  );
}
