import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Amministrazione | Insieme Oltre",
  // robots.txt blocca la scansione; questo meta impedisce l'indicizzazione anche se /admin viene linkato altrove.
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
