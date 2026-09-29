export type PillarContent = {
  number: string;
  title: string;
  text: string;
};

export type StoryContent = {
  name: string;
  line: string;
  photo?: string;
  accent: "coral" | "sage" | "gold";
};

export type HomeContent = {
  meta: {
    title: string;
    description: string;
  };
  nav: {
    cta: string;
  };
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    lead: string;
    primaryCta: string;
    secondaryCta: string;
    note: string;
    whisperLine1: string;
    whisperLine2: string;
    whisperStrong: string;
  };
  emotionalOpening: {
    kicker: string;
    titleLine1: string;
    titleLine2: string;
    paragraphs: string[];
  };
  manifesto: {
    kicker: string;
    titleLine1: string;
    titleLine2: string;
    paragraphs: string[];
  };
  pillars: {
    kicker: string;
    titleLine1: string;
    titleLine2: string;
    intro: string;
    items: PillarContent[];
  };
  aurora: {
    kicker: string;
    title: string;
    subtitle: string;
    paragraphs: string[];
    quote: string;
    closingLine1: string;
    closingLine2: string;
  };
  auroraStory: {
    cardDescription: string;
    cardLink: string;
    subtitle: string;
    paragraphs: string[];
    pauseLine1: string;
    pauseLine2: string;
    parentsTitle: string;
    parentsParagraphs: string[];
  };
  stories: {
    kicker: string;
    titleLine1: string;
    titleLine2: string;
    items: StoryContent[];
    comingSoon: string;
  };
  numbers: {
    label: string;
    titleLine1: string;
    titleLine2: string;
    text: string;
  };
  promise: {
    kicker: string;
    titleLine1: string;
    titleLine2: string;
    accent: string;
    note: string;
  };
  join: {
    kicker: string;
    titleLine1: string;
    titleLine2: string;
    text: string;
    cta: string;
  };
  footer: {
    brand: string;
    slogan: string;
    note: string;
    backTop: string;
  };
};

export const defaultHomeContent: HomeContent = {
  meta: {
    title: "Insieme Oltre | L’amore non si misura in cromosomi",
    description:
      "Insieme Oltre è una comunità di famiglie e persone di ogni età. Ascolto, autonomia, inclusione e possibilità, dall’infanzia alla vita adulta.",
  },
  nav: {
    cta: "Unisciti a noi",
  },
  hero: {
    eyebrow: "Famiglie. Persone. Possibilità.",
    titleLine1: "L’amore non si misura",
    titleLine2: "in cromosomi.",
    lead:
      "Ci sono giorni in cui vorresti solo parlare con qualcuno che capisca. Insieme Oltre nasce per incontrarci, ascoltarci e stare accanto ai nostri figli, piccoli e grandi, mentre trovano la propria strada.",
    primaryCta: "Scopri chi siamo",
    secondaryCta: "Conosci le storie",
    note: "Ogni persona è una storia intera.",
    whisperLine1: "non una diagnosi",
    whisperLine2: "non un limite",
    whisperStrong: "un futuro",
  },
  emotionalOpening: {
    kicker: "Da dove nasce",
    titleLine1: "Quando ti dicono un numero,",
    titleLine2: "tu cerchi un volto.",
    paragraphs: [
      "All’inizio arrivano parole grandi, fredde, difficili. Poi guardi tuo figlio o tua figlia e capisci che nessuna parola potrà mai contenerli davvero. E continui a scoprirlo mentre crescono.",
      "Insieme Oltre nasce qui: dal bisogno di non sentirsi soli, di trovare famiglie che capiscono, di immaginare un futuro senza abbassare lo sguardo.",
    ],
  },
  manifesto: {
    kicker: "Quello che scegliamo di fare",
    titleLine1: "Nessuno cresce",
    titleLine2: "da solo.",
    paragraphs: [
      "Vogliamo creare occasioni per incontrarci, scambiarci domande ed esperienze. A volte qualcuno ha una risposta. Altre volte basta sapere che c’è chi ascolta davvero.",
      "Per un bambino può essere il primo giorno a scuola. Per un ragazzo, un’amicizia, una scelta, il desiderio di lavorare. Le possibilità cambiano con l’età; il diritto di cercarle no.",
      "Vorremmo che famiglie, scuole e persone del territorio facessero spazio a percorsi diversi. Perché ciascuno possa trovare il proprio posto, con i propri tempi e la propria voce.",
    ],
  },
  pillars: {
    kicker: "Quello che vogliamo costruire",
    titleLine1: "Un posto dove",
    titleLine2: "sentirsi parte.",
    intro:
      "Vorremmo che ogni famiglia trovasse qualcuno con cui parlare e che ogni persona avesse spazio per essere sé stessa, da bambina e da adulta.",
    items: [
      {
        number: "01",
        title: "Famiglie",
        text: "A volte basta potersi dire: è successo anche a noi. Da lì possiamo cominciare a conoscerci e ad aiutarci.",
      },
      {
        number: "02",
        title: "Persone",
        text: "Un gioco preferito, un’amicizia, un sogno per domani: ogni età ha la sua voce. Vogliamo ascoltarla davvero.",
      },
      {
        number: "03",
        title: "Autonomia",
        text: "Un passo fatto da soli, una scelta propria, un lavoro desiderato: l’autonomia cambia forma crescendo. Servono tempo, fiducia e opportunità.",
      },
      {
        number: "04",
        title: "Inclusione",
        text: "A scuola, tra amici, al lavoro, nelle proprie città: esserci insieme dovrebbe essere normale, a ogni età.",
      },
    ],
  },
  aurora: {
    kicker: "Conosciamoci per nome",
    title: "Aurora.",
    subtitle: "Prima di tutto, una bambina.",
    paragraphs: [
      "Aurora non è arrivata nella nostra vita per insegnarci una lezione. È arrivata semplicemente per essere nostra figlia.",
      "Ci sono stati giorni di paura, domande senza risposta e parole difficili da ascoltare. Poi, piano piano, abbiamo imparato a guardarla davvero: il suo carattere, i suoi tempi, le sue conquiste.",
      "Ha sorrisi che riempiono una stanza e quel modo tutto suo di farsi capire. Prima di qualunque parola clinica, c’è lei.",
    ],
    quote: "Se vuoi conoscere Aurora, contarle i cromosomi non servirà a molto.",
    closingLine1: "Il suo cromosoma in più appartiene alla sua storia.",
    closingLine2: "Ma non sarà mai tutta la sua storia.",
  },
  auroraStory: {
    cardDescription: "Sto scoprendo il mondo un passo alla volta, con il mio sorriso, il mio carattere e i miei tempi. E ogni giorno ricordo a mamma e papà che una persona è infinitamente più grande di qualsiasi definizione.",
    cardLink: "Conosci la mia storia →",
    subtitle: "Prima di tutto, una bambina.",
    paragraphs: [
      "Aurora non è arrivata nella nostra vita per insegnarci una lezione. È arrivata semplicemente per essere nostra figlia.",
      "E da quel momento è diventata una parte di noi che non sapevamo nemmeno ci mancasse.",
      "Ha il suo carattere. I suoi tempi. Le sue conquiste. Le giornate semplici e quelle più complicate. I sorrisi che riempiono una stanza e quel modo tutto suo di farsi capire.",
      "Aurora ha anche un cromosoma in più.\nMa se vuoi conoscerla davvero, contarli non servirà a molto.",
      "Dovrai guardarla negli occhi. Dovrai aspettare il suo sorriso. Dovrai vederla andare incontro al mondo.",
      "Perché Aurora non è una diagnosi. Non è una percentuale. Non è una previsione scritta su un foglio.",
      "Aurora è Aurora.\nEd è la cosa più bella che ci sia mai accaduta.",
    ],
    pauseLine1: "Il suo cromosoma in più appartiene alla sua storia.",
    pauseLine2: "Ma non sarà mai tutta la sua storia.",
    parentsTitle: "Quando è nata Aurora, è nata anche una nuova parte di noi.",
    parentsParagraphs: [
      "Abbiamo conosciuto paure che prima non conoscevamo. Abbiamo imparato parole che non avremmo mai pensato di dover imparare. Abbiamo aspettato, sperato, festeggiato conquiste che per altri possono sembrare piccole.",
      "Ma soprattutto abbiamo scoperto una cosa molto più semplice:",
      "non dovevamo imparare ad amare Aurora.\nDovevamo soltanto conoscerla.",
      "Perché l’amore era già lì.",
    ],
  },
  stories: {
    kicker: "Storie vere, vite intere",
    titleLine1: "Dietro ogni nome",
    titleLine2: "c’è un mondo.",
    items: [
      { name: "Aurora", line: "Ho una luce tutta mia.", photo: "/aurora-storia.jpg", accent: "coral" },
      { name: "Alessandro", line: "", accent: "sage" },
      { name: "Emanuele", line: "", accent: "gold" },
      { name: "Celeste", line: "", accent: "coral" },
      { name: "Vincenzo", line: "", accent: "sage" },
      { name: "Eleonora", line: "", accent: "gold" },
      { name: "Biagio", line: "", accent: "coral" },
    ],
    comingSoon: "Presto, raccontato dalla sua famiglia.",
  },
  numbers: {
    label: "46 oppure 47 cromosomi",
    titleLine1: "Cambia un numero.",
    titleLine2: "Non il valore.",
    text:
      "Una persona non è una statistica, una previsione o una definizione. È relazioni, sogni, desideri, voce. È il proprio posto nel mondo.",
  },
  promise: {
    kicker: "Il nostro impegno",
    titleLine1: "Non vogliamo raccontare",
    titleLine2: "una diagnosi.",
    accent: "Vogliamo raccontare delle vite.",
    note:
      "Crescere. Sbagliare. Imparare. Fare amicizia. Sognare. Scegliere. Avere un posto nel mondo senza doverlo continuamente conquistare.",
  },
  join: {
    kicker: "Insieme, oltre",
    titleLine1: "Il futuro non si aspetta.",
    titleLine2: "Si costruisce insieme.",
    text:
      "Siamo all’inizio. Vorremmo costruire questo posto insieme alle famiglie, ascoltando anche ciò di cui hanno davvero bisogno.",
    cta: "Cominciamo da qui",
  },
  footer: {
    brand: "Insieme Oltre",
    slogan: "L’amore non si misura in cromosomi.",
    note: "Un progetto di famiglie, persone e possibilità.",
    backTop: "Torna su ↑",
  },
};

function mergeHomeContent(base: HomeContent, incoming: unknown): HomeContent {
  if (!incoming || typeof incoming !== "object") return base;

  const candidate = incoming as Partial<HomeContent>;

  return {
    ...base,
    ...candidate,
    meta: { ...base.meta, ...candidate.meta },
    nav: { ...base.nav, ...candidate.nav },
    hero: {
      ...base.hero,
      ...candidate.hero,
      titleLine1: base.hero.titleLine1,
      titleLine2: base.hero.titleLine2,
    },
    emotionalOpening: { ...base.emotionalOpening, ...candidate.emotionalOpening },
    manifesto: { ...base.manifesto, ...candidate.manifesto },
    pillars: {
      ...base.pillars,
      ...candidate.pillars,
      items: candidate.pillars?.items ?? base.pillars.items,
    },
    aurora: { ...base.aurora, ...candidate.aurora },
    auroraStory: {
      ...base.auroraStory,
      ...candidate.auroraStory,
      paragraphs: candidate.auroraStory?.paragraphs ?? base.auroraStory.paragraphs,
      parentsParagraphs: candidate.auroraStory?.parentsParagraphs ?? base.auroraStory.parentsParagraphs,
    },
    stories: {
      ...base.stories,
      ...candidate.stories,
      items: candidate.stories?.items ?? base.stories.items,
    },
    numbers: { ...base.numbers, ...candidate.numbers },
    promise: { ...base.promise, ...candidate.promise },
    join: { ...base.join, ...candidate.join },
    footer: { ...base.footer, ...candidate.footer, slogan: base.footer.slogan },
  };
}

export async function getHomeContent(): Promise<HomeContent> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return defaultHomeContent;
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/site_content?key=eq.home&select=value&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) return defaultHomeContent;

    const rows = (await response.json()) as { value?: unknown }[];
    return mergeHomeContent(defaultHomeContent, rows[0]?.value);
  } catch {
    return defaultHomeContent;
  }
}
