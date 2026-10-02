import AuthHashRedirect from "./AuthHashRedirect";
import { StoryCard, storyRowStyle } from "./components/StoryCard";
import { MusicExperience } from "./components/music/MusicExperience";
import { childAccent, isPublished, PHOTO_PATTERN, type ChildStory } from "../lib/children";
import { photoMoments } from "../lib/musicTimeline";
import { getHomeContent } from "../lib/siteContent";
import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";

const logoTopSrc = "/insieme-oltre-logo-top.png";
const logoFullSrc = "/insieme-oltre-logo.png";

/** Al massimo una foto per bambino e solo quante ne servono alla canzone: le foto restano facoltative. */
function musicPhotos(children: ChildStory[]) {
  return children
    .map((child) => child.photos.find((photo) => PHOTO_PATTERN.test(photo) && existsSync(join(process.cwd(), "public", photo.slice(1)))))
    .filter((photo): photo is string => Boolean(photo))
    .slice(0, photoMoments.length);
}

function HeartLine() {
  return (
    <svg className="heart-line" viewBox="0 0 160 70" aria-hidden="true">
      <path d="M4 42C31 47 46 43 61 31c9-8 12-22 4-26-9-5-19 3-16 13 4 13 25 21 44 20 21-1 37-9 63-29" />
    </svg>
  );
}

export default async function Home() {
  const content = await getHomeContent();
  const children = content.children.filter((child) => child.name.trim());

  return (
    <main>
      <AuthHashRedirect />
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Insieme Oltre, torna all'inizio">
          <span className="brand-dot" aria-hidden="true">♥</span>
          <span>Insieme <em>Oltre</em></span>
        </a>
        <nav aria-label="Navigazione principale">
          <a href="#manifesto">Chi siamo</a>
          <a href="#cosa-facciamo">Cosa facciamo</a>
          <a href="#storie">Storie</a>
          <a href="#futuro">Il futuro</a>
        </nav>
        <a className="header-cta" href="#unisciti">{content.nav.cta}</a>
      </header>

      <section className="hero" id="top">
        <div className="hero-noise" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">{content.hero.eyebrow}</p>
          <h1>
            {content.hero.titleLine1}
            <span>{content.hero.titleLine2}</span>
          </h1>
          <p className="hero-lead">{content.hero.lead}</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#manifesto">{content.hero.primaryCta} <span>→</span></a>
            <a className="button button-ghost" href="#storie">{content.hero.secondaryCta}</a>
          </div>
          <div className="hand-note">{content.hero.note}</div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="sun-orbit orbit-one" />
          <div className="sun-orbit orbit-two" />
          <div className="portrait-halo logo-frame">
            <Image
              className="hero-logo-img"
              src={logoTopSrc}
              alt=""
              width="1448"
              height="1086"
              priority
            />
          </div>
          <div className="hero-whisper">
            {content.hero.whisperLine1}<br/>{content.hero.whisperLine2}<br/><strong>{content.hero.whisperStrong}</strong>
          </div>
        </div>

        <a className="scroll-cue" href="#manifesto" aria-label="Scorri alla sezione successiva">
          <span>scorri</span><i>↓</i>
        </a>
      </section>

      <section className="emotional-opening section" aria-label="Il senso di Insieme Oltre">
        <div className="emotional-opening-inner">
          <p className="section-kicker">{content.emotionalOpening.kicker}</p>
          <h2>{content.emotionalOpening.titleLine1}<br/><em>{content.emotionalOpening.titleLine2}</em></h2>
          <div className="emotional-opening-copy">
            {content.emotionalOpening.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="manifesto section" id="manifesto">
        <div className="section-kicker">{content.manifesto.kicker}</div>
        <div className="manifesto-grid">
          <h2>{content.manifesto.titleLine1}<br/><em>{content.manifesto.titleLine2}</em></h2>
          <div className="manifesto-text">
            {content.manifesto.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <HeartLine />
          </div>
        </div>
      </section>

      <section className="pillars section" id="cosa-facciamo">
        <div className="section-heading">
          <div>
            <p className="section-kicker">{content.pillars.kicker}</p>
            <h2>{content.pillars.titleLine1}<br/>{content.pillars.titleLine2}</h2>
          </div>
          <p className="section-intro">{content.pillars.intro}</p>
        </div>
        <div className="pillar-grid">
          {content.pillars.items.map((pillar) => (
            <article className="pillar-card" key={pillar.title}>
              <span className="pillar-number">{pillar.number}</span>
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
              <span className="card-arrow" aria-hidden="true">↗</span>
            </article>
          ))}
        </div>
      </section>

      <section className="stories section" id="storie" aria-labelledby="stories-title">
        <div className="stories-title-wrap">
          <p className="section-kicker">{content.stories.kicker}</p>
          <h2 id="stories-title">{content.stories.titleLine1}<br/>{content.stories.titleLine2}</h2>
        </div>
        <div className="story-window" aria-label="Storie delle persone dell’associazione"
          style={storyRowStyle(children)}>
          <div className="story-track" style={{ animationDuration: `${Math.max(45, children.length * 8)}s` }}>
            {[false, true].map((duplicate) => (
              <div className="story-row" key={String(duplicate)} aria-hidden={duplicate || undefined}>
                {children.map((child, index) => (
                  <StoryCard key={child.id} child={child} accent={childAccent(index)} duplicate={duplicate} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <MusicExperience
        names={children.map((child) => ({
          id: child.id,
          name: child.name.trim(),
          href: isPublished(child) ? `/storie/${child.slug}` : null,
        }))}
        photos={musicPhotos(children)}
        slogan={content.footer.slogan}
        storiesHref="#storie"
        joinHref="#unisciti"
      />

      <section className="numbers" id="futuro">
        <div className="numbers-inner">
          <div className="numbers-big" aria-label={content.numbers.label}>
            <span>46</span><i>o</i><span>47</span>
          </div>
          <div className="numbers-copy">
            <h2>{content.numbers.titleLine1}<br/><em>{content.numbers.titleLine2}</em></h2>
            <p>{content.numbers.text}</p>
          </div>
        </div>
      </section>

      <section className="promise section">
        <p className="section-kicker">{content.promise.kicker}</p>
        <h2>
          {content.promise.titleLine1}<br/>{content.promise.titleLine2}
          <span>{content.promise.accent}</span>
        </h2>
        <p className="promise-note">{content.promise.note}</p>
      </section>

      <section className="join section" id="unisciti">
        <div className="join-symbol logo-frame-end">
          <Image
            className="official-logo"
            src={logoFullSrc}
            alt="Insieme Oltre — L’amore non si misura in cromosomi"
            width="1448"
            height="1086"
          />
        </div>
        <div className="join-copy">
          <p className="section-kicker">{content.join.kicker}</p>
          <h2>{content.join.titleLine1}<br/><em>{content.join.titleLine2}</em></h2>
          <p>{content.join.text}</p>
          <a className="button button-primary" href="#top">{content.join.cta} <span>↑</span></a>
        </div>
      </section>

      <footer>
        <div className="footer-brand">
          <span>Insieme <em>Oltre</em></span>
          <small>{content.footer.slogan}</small>
        </div>
        <p>{content.footer.note}</p>
        <a href="#top">{content.footer.backTop}</a>
      </footer>
    </main>
  );
}
