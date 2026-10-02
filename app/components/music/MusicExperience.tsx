"use client";

import { useEffect, useRef, useState } from "react";
import { finaleStep, musicSceneAt, musicTrack } from "../../../lib/musicTimeline";
import { MusicFinale } from "./MusicFinale";
import { MusicPhotos } from "./MusicPhotos";
import { MusicPlayer, type MusicStatus } from "./MusicPlayer";
import { MusicQuotes } from "./MusicQuotes";
import { NamesConstellation, type MusicName } from "./NamesConstellation";

/**
 * Sezione "Non veniamo da Marte". Lo stato visivo dipende solo dal tempo del brano:
 * in pausa la scena resta ferma dov'è, alla ripresa continua da lì, al riavvio riparte da capo.
 * La musica parte solo quando l'utente preme il pulsante.
 */
export function MusicExperience({ names, photos, slogan, storiesHref, joinHref }: {
  names: MusicName[];
  photos: string[];
  slogan: string;
  storiesHref: string;
  joinHref: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<MusicStatus>("idle");
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState<number>(musicTrack.duration);
  const [volume, setVolume] = useState(1);
  const [failed, setFailed] = useState(false);

  const started = status !== "idle";
  const ended = status === "ended";
  const scene = musicSceneAt(time, started, ended);

  useEffect(() => {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: musicTrack.title, artist: musicTrack.artist });
  }, []);

  // Al primo ascolto, se il pulsante è in basso nello schermo, porta il player in alto con calma
  // perché la scena che si apre sotto sia visibile. Dopo, lo scroll resta sempre libero.
  function bringIntoView() {
    const player = playerRef.current;
    if (!player) return;
    const top = player.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.4) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      player.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (status === "ended") {
      audio.currentTime = 0;
      setTime(0);
    }
    if (status === "idle") bringIntoView();
    setFailed(false);
    audio.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFailed(true);
    });
  }

  function seek(value: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setTime(value);
    if (status === "idle" || (status === "ended" && value < duration - 1)) setStatus("paused");
  }

  function changeVolume(value: number) {
    setVolume(value);
    if (audioRef.current) audioRef.current.volume = value;
  }

  function readDuration() {
    const value = audioRef.current?.duration;
    if (value && Number.isFinite(value)) setDuration(value);
  }

  return (
    <section className="music" id="canzone" data-state={status} data-scene={scene} aria-labelledby="music-title">
      <div className="music-sky" aria-hidden="true" />
      <div className="music-inner">
        <header className="music-head">
          <p className="section-kicker">Una canzone originale</p>
          <h2 id="music-title">Non veniamo da Marte</h2>
          <p className="music-subtitle">Una canzone per raccontare quello che siamo.</p>
        </header>

        <div ref={playerRef} className="music-player-wrap">
          <MusicPlayer
            status={status}
            time={time}
            duration={duration}
            volume={volume}
            onToggle={toggle}
            onSeek={seek}
            onVolume={changeVolume}
          />
          {failed && <p className="music-error" role="status">Non riusciamo a far partire il brano in questo momento. Riprova tra poco.</p>}
        </div>

        <div className="music-stage">
          <div className="music-stage-inner">
            <NamesConstellation names={names} time={time} scene={scene}>
              <div className="music-center">
                <MusicQuotes time={time} active={started && !ended} />
                <MusicPhotos photos={photos} time={time} active={started && !ended} />
                <MusicFinale step={started ? finaleStep(time, ended) : 0} slogan={slogan} storiesHref={storiesHref} joinHref={joinHref} />
              </div>
            </NamesConstellation>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setStatus("playing")}
        onPause={(event) => { if (!event.currentTarget.ended) setStatus("paused"); }}
        onEnded={() => { setStatus("ended"); setTime(duration); }}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onLoadedMetadata={readDuration}
        onDurationChange={readDuration}
      >
        {musicTrack.sources.map((source, index) => (
          <source
            key={source.src}
            src={source.src}
            type={source.type}
            // L'errore sull'ultima sorgente significa che nessun formato è disponibile.
            onError={index === musicTrack.sources.length - 1 ? () => setFailed(true) : undefined}
          />
        ))}
      </audio>
    </section>
  );
}
