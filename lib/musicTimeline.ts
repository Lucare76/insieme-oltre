// Regia dell'esperienza "Non veniamo da Marte": tempi, frasi e momenti visivi.
// Per regolare la sincronizzazione con la canzone basta cambiare i secondi qui sotto, senza toccare i componenti.

export const musicTrack = {
  title: "Non veniamo da Marte",
  artist: "Insieme Oltre",
  /** Solo file realmente presenti in /public/audio (es. aggiungere qui il .m4a quando ci sarà). */
  sources: [
    { src: "/audio/non-veniamo-da-marte.mp3", type: "audio/mpeg" },
  ],
  /** Durata indicativa (3:34), mostrata finché il browser non legge quella reale. */
  duration: 214,
} as const;

/**
 * - whisper: frase delicata, più piccola
 * - rise: frase che sale piano dal basso
 * - hero: il ritornello, al centro della scena (i nomi intorno si abbassano)
 * - together: tutti i nomi tornano insieme
 */
export type MusicCueEffect = "whisper" | "rise" | "hero" | "together";

export type MusicCue = {
  startTime: number;
  endTime: number;
  text: string;
  effect: MusicCueEffect;
};

// Tempi in secondi, stimati sulla struttura del brano: vanno rifiniti ascoltando la traccia definitiva.
export const musicTimeline: MusicCue[] = [
  { startTime: 12, endTime: 20, text: "Dietro ogni silenzio c’è un cuore che batte.", effect: "whisper" },
  { startTime: 26, endTime: 33, text: "Siamo bambini, non casi strani.", effect: "rise" },
  { startTime: 35, endTime: 42, text: "Guardateci bene, siamo esseri umani.", effect: "rise" },
  { startTime: 50, endTime: 57, text: "Non veniamo da Marte.", effect: "hero" },
  { startTime: 57, endTime: 63, text: "Siamo qui come voi.", effect: "rise" },
  { startTime: 66, endTime: 73, text: "L’inclusione non è un favore.", effect: "whisper" },
  { startTime: 92, endTime: 99, text: "Ogni pregiudizio toglie un’occasione.", effect: "rise" },
  { startTime: 100, endTime: 107, text: "Ogni sguardo aperto è una rivoluzione.", effect: "rise" },
  { startTime: 118, endTime: 125, text: "Non veniamo da Marte.", effect: "hero" },
  { startTime: 125, endTime: 131, text: "Siamo qui come voi.", effect: "rise" },
  { startTime: 168, endTime: 175, text: "Non veniamo da Marte.", effect: "hero" },
  { startTime: 194, endTime: 207, text: "Siamo bambini, siamo persone.", effect: "together" },
];

/** Momenti in cui può comparire una foto. Vanno messi dove non c'è una frase: foto e parole non si sovrappongono. */
export const photoMoments = [
  { startTime: 75, endTime: 87 },
  { startTime: 108, endTime: 116 },
  { startTime: 134, endTime: 146 },
];

export const musicMoments = {
  /** Il primo nome compare qui... */
  namesStart: 4,
  /** ...e tutti i nomi sono comparsi entro questo secondo, qualunque sia il loro numero. */
  namesAllBy: 48,
  /** Da qui l'esperienza si fa più essenziale: nomi più tenui, niente foto. */
  essentialFrom: 150,
  /** Da qui tutti i nomi tornano insieme, fino alla fine. */
  togetherFrom: 194,
} as const;

/** idle → intro → constellation ↔ chorus → essential → together → finale */
export type MusicScene = "idle" | "intro" | "constellation" | "chorus" | "essential" | "together" | "finale";

export function activeCueIndex(time: number) {
  return musicTimeline.findIndex((cue) => time >= cue.startTime && time < cue.endTime);
}

export function activePhotoMoment(time: number) {
  const index = photoMoments.findIndex((moment) => time >= moment.startTime && time < moment.endTime);
  return index === -1 ? null : index;
}

export function musicSceneAt(time: number, started: boolean, ended: boolean): MusicScene {
  if (ended) return "finale";
  if (!started) return "idle";
  if (time >= musicMoments.togetherFrom) return "together";
  if (musicTimeline[activeCueIndex(time)]?.effect === "hero") return "chorus";
  if (time >= musicMoments.essentialFrom) return "essential";
  if (time < musicMoments.namesStart + 4) return "intro";
  return "constellation";
}

/** Secondo in cui compare il nome in posizione `index`: entrano uno alla volta, distribuiti nel tempo. */
export function nameRevealTime(index: number, count: number) {
  const span = musicMoments.namesAllBy - musicMoments.namesStart;
  const step = Math.min(6, span / Math.max(1, count - 1));
  return musicMoments.namesStart + index * step;
}

export function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
