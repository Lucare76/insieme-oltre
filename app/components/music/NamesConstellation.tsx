import type { CSSProperties, ReactNode } from "react";
import { nameRevealTime, type MusicScene } from "../../../lib/musicTimeline";

export type MusicName = {
  id: string;
  name: string;
  /** Solo per le storie pubblicate: le altre restano nomi non cliccabili. */
  href: string | null;
};

/**
 * I nomi entrano uno alla volta in due fasce, sopra e sotto le frasi.
 * Sono in un flusso che va a capo da solo: non si sovrappongono mai e non escono dallo schermo,
 * anche quando l'amministratore aggiunge nuovi bambini.
 */
export function NamesConstellation({ names, time, scene, children }: {
  names: MusicName[];
  time: number;
  scene: MusicScene;
  children: ReactNode;
}) {
  const allVisible = scene === "together" || scene === "finale";
  const isVisible = (index: number) => scene !== "idle" && (allVisible || time >= nameRevealTime(index, names.length));

  const band = (position: "top" | "bottom") => (
    <ul className={`music-names music-names-${position}`} aria-label="I nomi dei nostri bambini">
      {names.map((child, index) => (index % 2 === (position === "top" ? 0 : 1)) && (
        <li
          key={child.id}
          className={isVisible(index) ? "music-name is-visible" : "music-name"}
          style={{ "--i": index } as CSSProperties}
        >
          {child.href
            ? <a href={child.href} aria-label={`Leggi la storia di ${child.name}`}>{child.name}</a>
            : <span>{child.name}</span>}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="music-constellation">
      {band("top")}
      {children}
      {band("bottom")}
    </div>
  );
}
