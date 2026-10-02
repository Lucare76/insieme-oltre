import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { siteUrl } from "../lib/siteUrl";
import "./globals.css";
import "./logo-fix.css";
import "./mobile-fix.css";
import "./music-experience.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Insieme Oltre | L’amore non si misura in cromosomi",
  description:
    "Insieme Oltre nasce a Ischia per le persone con trisomia 21 e altre disabilità intellettive o relazionali, le loro famiglie e una comunità più inclusiva.",
  metadataBase: new URL(siteUrl),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Insieme Oltre | L’amore non si misura in cromosomi",
    description: "A Ischia, storie, ascolto e nuove possibilità per persone con trisomia 21 e le loro famiglie.",
    type: "website",
    locale: "it_IT",
    url: "/",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
