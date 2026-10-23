import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Amministrazione | Insieme Oltre",
  // Il crawler può leggere noindex; l'accesso ai dati amministrativi resta riservato agli utenti autorizzati.
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
