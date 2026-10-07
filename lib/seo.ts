import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { PHOTO_PATTERN } from "./children";
import { siteUrl } from "./siteUrl";

// Metadata condivisi: Next unisce `openGraph` e `twitter` in modo superficiale,
// quindi ogni pagina che li ridefinisce parte da queste basi per non perdere siteName e immagini.

export const SITE_NAME = "Insieme Oltre";
export const SLOGAN = "L’amore non si misura in cromosomi.";

/** Title per i motori di ricerca: descrittivo. Lo slogan resta nell'anteprima social. */
export const homeTitle = "Insieme Oltre | Associazione famiglie e inclusione a Ischia";
export const homeSocialTitle = "Insieme Oltre | L’amore non si misura in cromosomi";
export const homeDescription =
  "Insieme Oltre nasce a Ischia per le persone con trisomia 21 e altre disabilità intellettive o relazionali, per le loro famiglie e per l’inclusione nella comunità.";
export const homeSocialDescription =
  "A Ischia, storie, ascolto e nuove possibilità per persone con trisomia 21 e le loro famiglie.";

/** Generata da app/opengraph-image.tsx (1200×630). */
export const defaultSocialImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — ${SLOGAN}`,
};

type SocialImage = { url: string; width?: number; height?: number; alt: string };

export const baseOpenGraph = {
  siteName: SITE_NAME,
  locale: "it_IT",
  type: "website",
  images: [defaultSocialImage],
} satisfies Metadata["openGraph"];

/** Open Graph + Twitter coerenti per una pagina; senza immagine usa la preview generale del sito. */
export function socialMetadata({
  title,
  description,
  path,
  type = "website",
  image = defaultSocialImage,
}: {
  title: string;
  description: string;
  path?: string;
  type?: "website" | "article";
  image?: SocialImage;
}): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: { ...baseOpenGraph, type, title, description, ...(path ? { url: path } : {}), images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** Prima foto della storia che esiste davvero in /public, come immagine social. */
export function storySocialImage(photos: string[], name: string): SocialImage | undefined {
  const photo = photos.find((item) => PHOTO_PATTERN.test(item) && existsSync(join(process.cwd(), "public", item.replace(/^\//, ""))));
  return photo ? { url: photo, alt: name } : undefined;
}

/** Solo dati certi: niente indirizzo, telefono, social o dati legali finché non sono definitivi. */
export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: siteUrl,
  logo: `${siteUrl}/insieme-oltre-logo.png`,
  description: homeDescription,
  slogan: SLOGAN,
  areaServed: { "@type": "Place", name: "Ischia" },
};
