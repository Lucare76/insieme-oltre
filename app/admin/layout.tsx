import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Amministrazione | Insieme Oltre",
  // La scansione è consentita per leggere il noindex; i dati restano protetti dall’autenticazione.
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
    googleBot: { index: false, follow: false, noarchive: true },
  },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
