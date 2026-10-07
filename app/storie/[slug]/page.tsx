import type { Metadata } from "next";
import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import Link from "next/link";
import { LegalLinks } from "../../components/LegalLinks";
import { notFound } from "next/navigation";
import { PHOTO_PATTERN, hasDedicatedPage, isPublished, storyParagraphs } from "../../../lib/children";
import { getHomeContent } from "../../../lib/siteContent";
import { socialMetadata, storySocialImage } from "../../../lib/seo";
import "../aurora/story.css";

type Props = { params: Promise<{ slug: string }> };

async function findStory(slug: string) {
  const { children } = await getHomeContent();
  const child = children.find((item) => item.slug === slug);
  // Le storie con una pagina dedicata hanno la loro route statica (es. app/storie/aurora).
  return child && isPublished(child) && !hasDedicatedPage(child) ? child : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const child = await findStory((await params).slug);
  if (!child) return {};

  const path = `/storie/${child.slug}`;
  const description = child.storyTitle || child.cardSubtitle;
  return {
    title: `${child.name} | Insieme Oltre`,
    description,
    alternates: { canonical: path },
    ...socialMetadata({
      title: `La storia di ${child.name} | Insieme Oltre`,
      description,
      path,
      type: "article",
      image: storySocialImage(child.photos, child.name),
    }),
  };
}

export default async function ChildStoryPage({ params }: Props) {
  const child = await findStory((await params).slug);
  if (!child) notFound();

  const photos = child.photos.filter((photo) => PHOTO_PATTERN.test(photo) && existsSync(join(process.cwd(), "public", photo.slice(1))));
  const paragraphs = storyParagraphs(child.storyText);
  const closing = paragraphs.length > 1 ? paragraphs[paragraphs.length - 1] : null;
  const body = closing ? paragraphs.slice(0, -1) : paragraphs;

  return (
    <main className="aurora-page">
      <header className="aurora-page-header">
        <Link href="/" className="aurora-page-brand">Insieme <em>Oltre</em></Link>
        <Link href="/#storie" className="aurora-page-back">← Torna alle storie</Link>
      </header>

      <article>
        {photos[0] && (
          <div className="aurora-page-photo aurora-page-photo-opening">
            <Image src={photos[0]} alt={child.name} fill sizes="100vw" priority />
          </div>
        )}
        <section className="aurora-page-intro">
          <h1>{child.name}</h1>
          {child.storyTitle && <p>{child.storyTitle}</p>}
        </section>

        <section className="aurora-page-prose">
          {body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </section>

        {photos.length > 1 && (
          <section className="aurora-page-pause" aria-label={`${child.name} in fotografia`}>
            <div className="aurora-page-gallery">
              {photos.slice(1).map((photo, index) => (
                <div className="aurora-page-photo aurora-page-photo-pause" key={photo}>
                  <Image src={photo} alt={`${child.name}, fotografia ${index + 2}`} fill sizes="(max-width: 620px) 100vw, 500px" />
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
        <div className="aurora-page-footer-end">
          <span>L’amore non si misura in cromosomi.</span>
          <LegalLinks className="aurora-page-legal" />
        </div>
      </footer>
    </main>
  );
}
