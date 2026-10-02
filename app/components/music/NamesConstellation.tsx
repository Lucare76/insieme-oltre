import type { CSSProperties, ReactNode } from "react";
import { nameRevealTime, type MusicScene } from "../../../lib/musicTimeline";

export type MusicName = {
  id: string;
  name: string;
  /** Solo per le storie pubblicate: le altre restano nomi non cliccabili. */
  href: string | null;
};

/** Ordine casuale (Fisher-Yates). Va chiamata in un gestore di eventi, mai durante il render. */
export function shuffleIds(ids: string[]) {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Applica l'ordine scelto; i nomi non ancora presenti nell'ordine restano in coda. */
export function orderNames(names: MusicName[], order: string[] | null) {
  if (!order) return names;
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...names].sort((a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length));
}

/**
 * Fluttuazione propria di ogni nome, ricavata dalla posizione: 3-8 px in verticale, meno di 2 px in orizzontale,
 * 5-10 s di durata e direzione alternata. Valori deterministici, quindi uguali fra server e client.
 */
function floatStyle(index: number): CSSProperties {
  return {
    "--i": index,
    "--float-y": `${3 + ((index * 37) % 6)}px`,
    "--float-x": `${(index % 2 ? -1 : 1) * (0.75 + ((index * 53) % 3) * 0.5)}px`,
    "--float-duration": `${5 + ((index * 29) % 5) + ((index * 7) % 10) / 10}s`,
    "--float-delay": `${-((index * 1.7) % 6).toFixed(1)}s`,
  } as CSSProperties;
}

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
          style={floatStyle(index)}
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
