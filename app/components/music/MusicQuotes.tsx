import { activeCueIndex, musicTimeline } from "../../../lib/musicTimeline";

// Tutte le frasi restano impilate nello stesso punto: cambia solo quale è visibile, così entrano ed escono in dissolvenza.
export function MusicQuotes({ time, active }: { time: number; active: boolean }) {
  const current = active ? activeCueIndex(time) : -1;

  return musicTimeline.map((cue, index) => (
    <p
      key={`${cue.startTime}-${cue.text}`}
      className={`music-quote music-quote-${cue.effect}${index === current ? " is-active" : ""}`}
      aria-hidden={index !== current}
    >
      {cue.text}
    </p>
  ));
}
