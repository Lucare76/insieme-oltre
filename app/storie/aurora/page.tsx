import type { Metadata } from "next";
import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import Link from "next/link";
import { getHomeContent } from "../../../lib/siteContent";
import "./story.css";

const photoPath = "/aurora-storia.jpg";

export const metadata: Metadata = {
  title: "Aurora | Insieme Oltre",
  description: "Aurora è Aurora. La sua storia raccontata da mamma e papà.",
};

export default async function AuroraStoryPage() {
  const hasPhoto = existsSync(join(process.cwd(), "public", "aurora-storia.jpg"));
  const { auroraStory: story } = await getHomeContent();

  return (
    <main className="aurora-page">
      <header className="aurora-page-header">
        <Link href="/" className="aurora-page-brand">Insieme <em>Oltre</em></Link>
        <Link href="/#storie" className="aurora-page-back">← Torna alle storie</Link>
      </header>

      <article>
        {hasPhoto && (
          <div className="aurora-page-photo aurora-page-photo-opening">
            <Image src={photoPath} alt="Aurora" fill sizes="100vw" priority />
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
          {hasPhoto && (
            <div className="aurora-page-photo aurora-page-photo-pause">
              <Image src={photoPath} alt="Aurora" fill sizes="(max-width: 620px) 100vw, 1000px" />
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
        <span>L’amore non si misura in cromosomi.</span>
      </footer>
    </main>
  );
}
