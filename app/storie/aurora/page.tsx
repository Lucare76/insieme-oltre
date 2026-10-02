import type { Metadata } from "next";
import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import Link from "next/link";
import { LegalLinks } from "../../components/LegalLinks";
import { getHomeContent } from "../../../lib/siteContent";
import "./story.css";

const photoNames = ["aurora-storia.jpg", "aurora-storia-2.jpg", "aurora-storia-3.jpg"];

export const metadata: Metadata = {
  title: "Aurora | Insieme Oltre",
  description: "Aurora è Aurora. La sua storia raccontata da mamma e papà.",
  alternates: { canonical: "/storie/aurora" },
  openGraph: {
    title: "La storia di Aurora | Insieme Oltre",
    description: "Aurora è Aurora. La sua storia raccontata da mamma e papà.",
    url: "/storie/aurora",
    type: "article",
    locale: "it_IT",
  },
};

export default async function AuroraStoryPage() {
  const photos = photoNames.filter((name) => existsSync(join(process.cwd(), "public", name)));
  const { auroraStory: story } = await getHomeContent();

  return (
    <main className="aurora-page">
      <header className="aurora-page-header">
        <Link href="/" className="aurora-page-brand">Insieme <em>Oltre</em></Link>
        <Link href="/#storie" className="aurora-page-back">← Torna alle storie</Link>
      </header>

      <article>
        {photos[0] && (
          <div className="aurora-page-photo aurora-page-photo-opening">
            <Image src={`/${photos[0]}`} alt="Aurora" fill sizes="100vw" priority />
          </div>
        )}
        <section className="aurora-page-intro">
          <h1>Aurora</h1>
          <p>{story.subtitle}</p>
        </section>

        <section className="aurora-page-prose">
          {story.paragraphs.map((paragraph, index) => (
            <p className={index === story.paragraphs.length - 1 ? "aurora-page-declaration" : undefined} key={index}>{paragraph}</p>
          ))}
        </section>

        <section className="aurora-page-pause" aria-label="Una parte della sua storia">
          {photos.length > 1 && (
            <div className="aurora-page-gallery">
              {photos.slice(1).map((name, index) => (
                <div className="aurora-page-photo aurora-page-photo-pause" key={name}>
                  <Image src={`/${name}`} alt={`Aurora, fotografia ${index + 2}`} fill sizes="(max-width: 620px) 100vw, 500px" />
                </div>
              ))}
            </div>
          )}
          <p>{story.pauseLine1}<br/>{story.pauseLine2}</p>
        </section>

        <section className="aurora-page-parents">
          <h2>{story.parentsTitle}</h2>
          {story.parentsParagraphs.map((paragraph, index) => (
            <p className={index === 2 ? "aurora-page-declaration" : undefined} key={index}>{paragraph}</p>
          ))}
        </section>
      </article>

      <footer className="aurora-page-footer">
        <Link href="/">Insieme Oltre</Link>
        <div className="aurora-page-footer-end">
          <span>L’amore non si misura in cromosomi.</span>
          <LegalLinks className="aurora-page-legal" />
        </div>
      </footer>
    </main>
  );
}
