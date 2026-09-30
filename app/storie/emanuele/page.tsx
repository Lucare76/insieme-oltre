import type { Metadata } from "next";
import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import Link from "next/link";
import { getHomeContent } from "../../../lib/siteContent";
import "../aurora/story.css";

export const metadata: Metadata = {
  title: "Emanuele | Insieme Oltre",
  description: "Il suo volo verso la vita e la scoperta del mondo. La storia di Emanuele raccontata dalla sua famiglia.",
  alternates: { canonical: "/storie/emanuele" },
  openGraph: {
    title: "La storia di Emanuele | Insieme Oltre",
    description: "Il suo volo verso la vita e la scoperta del mondo. La storia di Emanuele raccontata dalla sua famiglia.",
    url: "/storie/emanuele",
    type: "article",
    locale: "it_IT",
  },
};

export default async function EmanueleStoryPage() {
  const { emanueleStory: story } = await getHomeContent();
  const photos = story.photos
    .slice(0, 3)
    .filter((photo) => /^\/(?:storie\/)?[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$/i.test(photo)
      && existsSync(join(process.cwd(), "public", photo.slice(1))));
  const closing = story.paragraphs[story.paragraphs.length - 1];

  return (
    <main className="aurora-page">
      <header className="aurora-page-header">
        <Link href="/" className="aurora-page-brand">Insieme <em>Oltre</em></Link>
        <Link href="/#storie" className="aurora-page-back">← Torna alle storie</Link>
      </header>

      <article>
        {photos[0] && (
          <div className="aurora-page-photo aurora-page-photo-opening">
            <Image src={photos[0]} alt="Emanuele" fill sizes="100vw" priority />
          </div>
        )}
        <section className="aurora-page-intro">
          <h1>Emanuele</h1>
          <p>{story.title}</p>
        </section>

        <section className="aurora-page-prose">
          {story.paragraphs.slice(0, -1).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>

        {photos.length > 1 && (
          <section className="aurora-page-pause" aria-label="Emanuele in fotografia">
            <div className="aurora-page-gallery">
              {photos.slice(1).map((photo, index) => (
                <div className="aurora-page-photo aurora-page-photo-pause" key={photo}>
                  <Image src={photo} alt={`Emanuele, fotografia ${index + 2}`} fill sizes="(max-width: 620px) 100vw, 500px" />
                </div>
              ))}
            </div>
          </section>
        )}

        {closing && (
          <section className="aurora-page-parents">
            <p className="aurora-page-declaration">{closing}</p>
          </section>
        )}
      </article>

      <footer className="aurora-page-footer">
        <Link href="/">Insieme Oltre</Link>
        <span>L’amore non si misura in cromosomi.</span>
      </footer>
    </main>
  );
}
