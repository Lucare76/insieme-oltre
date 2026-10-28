import type { Metadata } from "next";
import { homeDescription, homeSocialDescription, homeSocialTitle, homeTitle, socialMetadata } from "../lib/seo";
import { siteUrl } from "../lib/siteUrl";
import "./globals.css";
import "./logo-fix.css";
import "./mobile-fix.css";
import "./music-experience.css";


// Il canonical sta nelle singole pagine: qui verrebbe ereditato anche da /admin e dalle 404.
export const metadata: Metadata = {
  title: homeTitle,
  description: homeDescription,
  metadataBase: new URL(siteUrl),
  // La preview serve alla revisione: non deve competere con il dominio pubblico.
  ...(process.env.VERCEL_ENV === "preview" ? { robots: { index: false, follow: false } } : {}),
  ...socialMetadata({ title: homeSocialTitle, description: homeSocialDescription }),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // La homepage aggiunge a <html> la classe delle animazioni d'ingresso prima che React parta (vedi ScrollReveal).
    <html lang="it" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
