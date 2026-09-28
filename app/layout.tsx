import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "./logo-fix.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Insieme Oltre | L’amore non si misura in cromosomi",
  description:
    "Insieme Oltre è una comunità di famiglie che mette al centro bambini, persone, autonomia, inclusione e possibilità.",
  metadataBase: new URL("https://insieme-oltre.vercel.app"),
  openGraph: {
    title: "Insieme Oltre",
    description: "L’amore non si misura in cromosomi.",
    type: "website",
    locale: "it_IT",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
