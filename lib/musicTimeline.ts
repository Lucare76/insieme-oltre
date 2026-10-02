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
 * - hero: primo ritornello, grande e luminoso al centro (i nomi si abbassano)
 * - hero-sober: secondo ritornello, stesso linguaggio ma più asciutto
 * - hero-final: ritornello finale, più intimo ed emozionale
 * - together: tutti i nomi tornano insieme
 */
export type MusicCueEffect = "whisper" | "rise" | "hero" | "hero-sober" | "hero-final" | "together";

export type MusicCue = {
  startTime: number;
  endTime: number;
  text: string;
  effect: MusicCueEffect;
};

// Tempi in secondi misurati sulla traccia (in commento il momento in cui la frase viene cantata).
// Ogni frase entra ~0,3-0,6 s prima della voce; fra due frasi resta il tempo della dissolvenza di uscita (~0,8 s),
// così non sono mai visibili due frasi insieme.
export const musicTimeline: MusicCue[] = [
  // Pre-ritornello
  { startTime: 31.4, endTime: 36.2, text: "Dietro ogni silenzio c’è un cuore che batte.", effect: "whisper" }, // 31,9–35,4
  // Primo ritornello
  { startTime: 39.5, endTime: 42.1, text: "Non veniamo da Marte.", effect: "hero" }, // 40,6–42,2
  { startTime: 42.9, endTime: 46.4, text: "Siamo qui come voi.", effect: "rise" }, // 42,7–44,4
  { startTime: 56.4, endTime: 60.8, text: "L’inclusione non è un favore.", effect: "rise" }, // 56,9–60,3
  { startTime: 68.2, endTime: 71.6, text: "Siamo bambini, non casi strani.", effect: "rise" }, // 68,7–72,1
  { startTime: 72.3, endTime: 77.4, text: "Guardateci bene, siamo esseri umani.", effect: "rise" }, // 72,5–76,0
  // Secondo ritornello: più sobrio, poi spazio ai nomi
  { startTime: 115.2, endTime: 117.7, text: "Non veniamo da Marte.", effect: "hero-sober" }, // 115,9–118,0
  { startTime: 118.4, endTime: 122.4, text: "Siamo qui come voi.", effect: "rise" }, // 118,0–119,9
  { startTime: 131.8, endTime: 136.4, text: "L’inclusione non è un favore.", effect: "whisper" }, // 132,2–135,6
  // Ponte
  { startTime: 151.8, endTime: 155.3, text: "Ogni pregiudizio toglie un’occasione.", effect: "whisper" }, // 152,2–155,6
  { startTime: 156.0, endTime: 160.4, text: "Ogni sguardo aperto è una rivoluzione.", effect: "rise" }, // 156,2–159,8
  // Ritornello finale: entra nella pausa di silenzio che lo precede (qui si canta "siamo qui per restare", non "come voi")
  { startTime: 168.2, endTime: 170.7, text: "Non veniamo da Marte.", effect: "hero-final" }, // 169,5–171,3
  { startTime: 171.4, endTime: 174.8, text: "Siamo qui per restare.", effect: "rise" }, // 171,5–173,6
  // Chiusura
  { startTime: 185.2, endTime: 190.8, text: "Siamo bambini, siamo persone.", effect: "together" }, // 185,7–189,4
];

/**
 * Momenti in cui può comparire una foto: solo nella seconda strofa e nella fine del ponte,
 * dove non c'è nessuna frase al centro. Ogni foto finisce di sparire prima della frase successiva.
 */
export const photoMoments = [
  { startTime: 86.0, endTime: 94.0 }, // "…la gioia dentro un sì / ogni conquista è un piccolo volo"
  { startTime: 107.5, endTime: 114.0 }, // "…quando invece vogliamo soltanto amare"
  { startTime: 161.4, endTime: 167.0 }, // "basta un abbraccio, un sorriso, un cammino"
];

export const musicMoments = {
  /** I nomi entrano durante intro e prima strofa... */
  namesStart: 1.5,
  /** ...e sono tutti comparsi prima della prima frase, qualunque sia il loro numero. */
  namesAllBy: 29,
  /** Dopo il ponte i nomi si attenuano, fino a "Siamo bambini, siamo persone". */
  essentialFrom: 160.5,
  /** "Siamo bambini, siamo persone": tutti i nomi tornano insieme. */
  togetherFrom: 185.2,
  /** Coda strumentale (la voce finisce a 194,4 s): compare "Insieme Oltre"... */
  finaleBrandFrom: 198.5,
  /** ...poi lo slogan. I pulsanti arrivano solo a brano concluso. */
  finaleSloganFrom: 203.5,
} as const;

/** idle → intro → constellation ↔ phrase/chorus → essential → together → finale */
export type MusicScene = "idle" | "intro" | "constellation" | "phrase" | "chorus" | "essential" | "together" | "finale";

const HERO_EFFECTS: MusicCueEffect[] = ["hero", "hero-sober", "hero-final"];

export function activeCueIndex(time: number) {
  return musicTimeline.findIndex((cue) => time >= cue.startTime && time < cue.endTime);
}

export function activePhotoMoment(time: number) {
  const index = photoMoments.findIndex((moment) => time >= moment.startTime && time < moment.endTime);
  return index === -1 ? null : index;
}

export function musicSceneAt(time: number, started: boolean, ended: boolean): MusicScene {
  if (ended || (started && time >= musicMoments.finaleBrandFrom)) return "finale";
  if (!started) return "idle";
  if (time >= musicMoments.togetherFrom) return "together";
  const cue = musicTimeline[activeCueIndex(time)];
  if (cue && HERO_EFFECTS.includes(cue.effect)) return "chorus";
  if (time >= musicMoments.essentialFrom) return "essential";
  if (cue) return "phrase";
  if (time < musicMoments.namesStart + 4) return "intro";
  return "constellation";
}

/**
 * Il ritornello e la frase che lo segue subito ("Siamo qui come voi.", "Siamo qui per restare.") sono un unico momento:
 * nella breve pausa fra i due e durante la seconda frase i nomi restano quasi fermi come nel ritornello.
 */
export function isChorusContinuation(time: number) {
  const index = musicTimeline.findIndex((cue, i) => {
    const previous = musicTimeline[i - 1];
    return previous && HERO_EFFECTS.includes(previous.effect) && !HERO_EFFECTS.includes(cue.effect)
      && cue.startTime - previous.endTime < 1.5 && time >= previous.endTime && time < cue.endTime;
  });
  return index !== -1;
}

/** Quanto del finale è visibile: 0 niente, 1 "Insieme Oltre", 2 anche lo slogan, 3 anche i pulsanti (brano finito). */
export function finaleStep(time: number, ended: boolean) {
  if (ended) return 3;
  if (time >= musicMoments.finaleSloganFrom) return 2;
  if (time >= musicMoments.finaleBrandFrom) return 1;
  return 0;
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
