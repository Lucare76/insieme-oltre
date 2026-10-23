"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";

const MusicExperience = lazy(() =>
  import("./music/MusicExperience").then((module) => ({ default: module.MusicExperience })),
);

type MusicName = {
  id: string;
  name: string;
  href: string | null;
};

type Props = {
  names: MusicName[];
  photos: string[];
  slogan: string;
  storiesHref: string;
  joinHref: string;
};

function MusicPlaceholder() {
  return (
    <section className="music music-lazy-placeholder" aria-labelledby="music-placeholder-title" aria-busy="true">
      <div className="music-inner">
        <header className="music-head">
          <p className="section-kicker">Una canzone originale</p>
          <h2 id="music-placeholder-title">Non veniamo da Marte</h2>
          <p className="music-subtitle">Una canzone per raccontare quello che siamo.</p>
        </header>
        <div className="music-player-wrap">
          <div className="music-player">
            <span className="music-play music-play-placeholder" aria-hidden="true">
              <span className="music-play-icon">▶</span>
              <span>Ascolta</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * L'esperienza musicale è molto sotto la piega e contiene quasi tutto il JS interattivo della home.
 * La carichiamo solo quando l'utente si avvicina alla sezione; il placeholder SSR mantiene lo spazio
 * e l'aspetto della sezione, evitando salti mentre arriva il chunk.
 */
export function LazyMusicExperience(props: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || load) return;

    if (!("IntersectionObserver" in window)) {
      setLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setLoad(true);
        observer.disconnect();
      },
      { rootMargin: "1200px 0px", threshold: 0.01 },
    );

    observer.observe(shell);
    return () => observer.disconnect();
  }, [load]);

  return (
    <div ref={shellRef} className="music-lazy-shell">
      {load ? (
        <Suspense fallback={<MusicPlaceholder />}>
          <MusicExperience {...props} />
        </Suspense>
      ) : (
        <MusicPlaceholder />
      )}
    </div>
  );
}
