import Image from "next/image";
import { activePhotoMoment, photoMoments } from "../../../lib/musicTimeline";

/**
 * Al massimo una foto per momento, solo dove non c'è una frase.
 * L'immagine viene montata pochi secondi prima del suo momento: nessuna foto si scarica al caricamento della home.
 */
export function MusicPhotos({ photos, time, active }: { photos: string[]; time: number; active: boolean }) {
  if (!photos.length || !active) return null;
  const current = activePhotoMoment(time);

  return photoMoments.map((moment, index) => {
    const near = time >= moment.startTime - 6 && time < moment.endTime + 3;
    if (!near) return null;
    return (
      <div key={moment.startTime} className={`music-photo${current === index ? " is-visible" : ""}`} aria-hidden="true">
        <Image src={photos[index % photos.length]} alt="" fill sizes="(max-width: 760px) 140px, 200px" />
      </div>
    );
  });
}
