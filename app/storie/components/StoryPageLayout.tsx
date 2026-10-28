import Image from "next/image";
import Link from "next/link";
import { LegalLinks } from "../../components/LegalLinks";
import { InstitutionalLine } from "../../components/InstitutionalLine";
import "../aurora/story.css";

type StoryPageLayoutProps = {
  name: string;
  subtitle: string;
  paragraphs: string[];
  photos: string[];
  pause?: { lines: string[] };
  parents?: { title: string; paragraphs: string[]; emphasizedIndex?: number };
};

/** Evidenzia le frasi marcate **così** nel testo dell'admin, senza mostrare gli asterischi. */
function renderStoryText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part,
  );
}

export function StoryPageLayout({ name, subtitle, paragraphs, photos, pause, parents }: StoryPageLayoutProps) {
  const availablePhotos = photos.filter(Boolean);
  const hasPause = availablePhotos.length > 1 || Boolean(pause?.lines.some((line) => line.trim()));

  return (
    <main className="aurora-page">
      <header className="aurora-page-header">
        <Link href="/" className="aurora-page-brand">Insieme <em>Oltre</em></Link>
        <Link href="/#storie" className="aurora-page-back">← Torna alle storie</Link>
      </header>

      <article>
        {availablePhotos[0] && (
          <div className="aurora-page-photo aurora-page-photo-opening">
            <Image src={availablePhotos[0]} alt={name} fill sizes="100vw" priority />
          </div>
        )}
        <section className="aurora-page-intro">
          <h1>{name}</h1>
          {subtitle && <p>{subtitle}</p>}
        </section>

        <section className="aurora-page-prose">
          {paragraphs.map((paragraph, index) => (
            <p className={index === paragraphs.length - 1 || /^\*\*[^*]+\*\*$/.test(paragraph.trim()) ? "aurora-page-declaration" : undefined} key={index}>
              {renderStoryText(paragraph)}
            </p>
          ))}
        </section>

        {hasPause && (
          <section className="aurora-page-pause" aria-label={pause ? "Una parte della sua storia" : `${name} in fotografia`}>
            {availablePhotos.length > 1 && (
              <div className="aurora-page-gallery">
                {availablePhotos.slice(1).map((photo, index) => (
                  <div className="aurora-page-photo aurora-page-photo-pause" key={photo}>
                    <Image src={photo} alt={`${name}, fotografia ${index + 2}`} fill sizes="(max-width: 620px) 100vw, 500px" />
                  </div>
                ))}
              </div>
            )}
            {pause?.lines.length ? <p>{pause.lines.map((line, index) => (
              <span key={index}>{index > 0 && <br />}{line}</span>
            ))}</p> : null}
          </section>
        )}

        {parents && (
          <section className="aurora-page-parents">
            <h2>{parents.title}</h2>
            {parents.paragraphs.map((paragraph, index) => (
              <p className={index === parents.emphasizedIndex ? "aurora-page-declaration" : undefined} key={index}>
                {renderStoryText(paragraph)}
              </p>
            ))}
          </section>
        )}
      </article>

      <footer className="aurora-page-footer">
        <Link href="/">Insieme Oltre</Link>
        <div className="aurora-page-footer-end">
          <span>L’amore non si misura in cromosomi.</span>
          <Link href="/chi-siamo">Conosci l’associazione Insieme Oltre a Ischia</Link>
          <LegalLinks className="aurora-page-legal" />
          <InstitutionalLine className="aurora-page-institutional" />
        </div>
      </footer>
    </main>
  );
}


