import { newChild, normalizeChildren, slugify, type ChildStory } from "./children";

export type PillarContent = {
  number: string;
  title: string;
  text: string;
};

function pendingChild(name: string): ChildStory {
  return { ...newChild(name), id: slugify(name) };
}

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
  /** Testi della pagina dedicata /storie/aurora (la card di Aurora sta in `children`). */
  auroraStory: {
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
  };
  /** Bambini nell'ordine in cui appaiono in homepage. */
  children: ChildStory[];
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
    kicker: "Chi siamo",
    titleLine1: "A Ischia,",
    titleLine2: "insieme.",
    paragraphs: [
      "Insieme Oltre nasce dal desiderio di creare sull’isola d’Ischia un punto di riferimento per chi cerca ascolto, relazioni e nuove possibilità. Nessuna famiglia dovrebbe affrontare da sola ogni domanda sul futuro.",
      "Il nostro progetto è rivolto alle persone con trisomia 21 e altre disabilità intellettive o relazionali e alle loro famiglie, in ogni fase della vita. Vogliamo partire dalla persona, dai suoi interessi e dalle sue scelte, oggi e negli anni che verranno.",
      "Immaginiamo luoghi e attività condivisi con amici, scuole e comunità locale. Perché conoscersi davvero rende più facile trovare il proprio posto, con i propri tempi e la propria voce.",
    ],
  },
  pillars: {
    kicker: "Cosa facciamo",
    titleLine1: "Possibilità",
    titleLine2: "da costruire.",
    intro:
      "Queste sono le direzioni del nostro progetto. Vogliamo trasformarle in occasioni concrete, insieme alle famiglie e alle persone del territorio.",
    items: [
      {
        number: "01",
        title: "Ascolto e famiglie",
        text: "Uno spazio per confrontarsi, orientarsi tra le pratiche e trovare altre famiglie con cui condividere domande ed esperienze.",
      },
      {
        number: "02",
        title: "Educazione e autonomia",
        text: "Percorsi educativi e laboratori per coltivare capacità e scelte quotidiane, fino ai progetti di vita, casa e lavoro.",
      },
      {
        number: "03",
        title: "Cultura e relazioni",
        text: "Attività artistiche e culturali aperte a tutti, dove persone con e senza disabilità possano incontrarsi e creare insieme.",
      },
      {
        number: "04",
        title: "Tempo libero e sport",
        text: "Gite, momenti di tempo libero condiviso e attività sportive adattate: modi semplici e importanti di stare insieme.",
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
  },
  children: [
    {
      id: "aurora",
      name: "Aurora",
      initial: "",
      cardTitle: "",
      cardSubtitle: "Ho una luce tutta mia.",
      cardText: "Sto scoprendo il mondo un passo alla volta, con il mio sorriso, il mio carattere e i miei tempi. E ogni giorno ricordo a mamma e papà che una persona è infinitamente più grande di qualsiasi definizione.",
      status: "pubblicata",
      slug: "aurora",
      storyTitle: "",
      storyText: "",
      // La pagina dedicata di Aurora usa le sue foto fisse (app/storie/aurora).
      photos: [],
    },
    pendingChild("Alessandro"),
    {
      id: "emanuele",
      name: "Emanuele",
      initial: "",
      cardTitle: "",
      cardSubtitle: "Il suo volo verso la vita.",
      cardText: "Il suo viaggio è cominciato con un volo, nelle prime ore di vita. Poi piccoli passi, ma costanti. Oggi Emanuele vola a modo suo: con un sorriso che illumina una stanza e uno sguardo curioso che scopre il mondo senza fretta.",
      status: "pubblicata",
      slug: "emanuele",
      storyTitle: "Il suo volo verso la vita e la scoperta del mondo",
      storyText: [
        "Le prime ore di vita di Emanuele non sono state semplici.",
        "Un viaggio in elicottero e, a poche ore dalla nascita, un’operazione per atresia duodenale.",
        "Anche la ripresa è stata lenta e graduale.\nPiccoli passi, ma costanti.",
        "E poi sono arrivate le piccole grandi conquiste:\nil primo biberon,\nil primo pannolino sporco,\nla prima tutina,\nla prima uscita con mamma, papà e la sorellina.",
        "Conquiste che forse, per qualcuno, possono sembrare piccole.\nPer noi, invece, sono state immense.",
        "Il suo viaggio non si è fermato a quel primo volo in elicottero.",
        "Oggi Emanuele vola a modo suo: con la forza di chi ha dovuto lottare fin dal primo giorno e con la dolcezza di chi sa guardare il mondo con occhi unici.",
        "Ogni suo giorno è una nuova conquista.",
        "La bellezza di Emanuele sta nel suo sorriso, quello che illumina una stanza e sa curare ogni paura passata.",
        "Sta nel suo sguardo curioso, che esplora la vita senza fretta, scoprendo ogni cosa a modo suo.",
        "La Trisomia 21 è solo una sfumatura del suo disegno, non è il suo confine.",
        "Emanuele ci insegna ogni giorno che non importa quanto sia stata ripida la salita all’inizio.",
        "Ciò che conta è la bellezza del paesaggio che stiamo scoprendo insieme.",
        "Un passo alla volta.\nUna conquista alla volta.\nE, perché no, un volo alla volta.",
        "Questo è il viaggio di Emanuele.\nIl suo meraviglioso volo verso la vita.",
      ].join("\n\n"),
      photos: ["/emanuele-storia.jpg", "/emanuele-storia-2.jpg", "/emanuele-storia-3.jpg"],
    },
    pendingChild("Celeste"),
    pendingChild("Vincenzo"),
    pendingChild("Eleonora"),
    pendingChild("Biagio"),
  ],
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

type LegacyContent = {
  stories?: { items?: unknown; comingSoon?: unknown; comingSoonLine?: unknown };
  auroraStory?: { cardDescription?: unknown };
  emanueleStory?: { title?: unknown; cardLine?: unknown; cardDescription?: unknown; paragraphs?: unknown; photos?: unknown };
};

const filled = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);

/** Converte i contenuti salvati prima dell'elenco `children` (stories.items, auroraStory.cardDescription, emanueleStory). */
function migrateLegacyChildren(base: ChildStory[], legacy: LegacyContent): ChildStory[] {
  const items = Array.isArray(legacy.stories?.items) ? (legacy.stories.items as { name?: unknown; line?: unknown }[]) : null;
  const pendingLine = filled(legacy.stories?.comingSoonLine);
  const pendingText = filled(legacy.stories?.comingSoon);

  const children = items
    ? items.flatMap((item) => {
      const name = filled(item?.name)?.trim();
      if (!name) return [];
      const child = { ...(base.find((known) => known.slug === slugify(name)) ?? pendingChild(name)) };
      const line = filled(item.line);
      if (line) child.cardSubtitle = line;
      else if (child.status === "in_arrivo" && pendingLine) child.cardSubtitle = pendingLine;
      if (child.status === "in_arrivo" && pendingText) child.cardText = pendingText;
      return [child];
    })
    : base.map((child) => ({ ...child }));

  const aurora = children.find((child) => child.slug === "aurora");
  if (aurora) aurora.cardText = filled(legacy.auroraStory?.cardDescription) ?? aurora.cardText;

  const emanuele = children.find((child) => child.slug === "emanuele");
  const oldEmanuele = legacy.emanueleStory;
  if (emanuele && oldEmanuele) {
    emanuele.storyTitle = filled(oldEmanuele.title) ?? emanuele.storyTitle;
    emanuele.cardSubtitle = filled(oldEmanuele.cardLine) ?? emanuele.cardSubtitle;
    emanuele.cardText = filled(oldEmanuele.cardDescription) ?? emanuele.cardText;
    if (Array.isArray(oldEmanuele.paragraphs)) emanuele.storyText = oldEmanuele.paragraphs.filter(filled).join("\n\n");
    if (Array.isArray(oldEmanuele.photos)) emanuele.photos = oldEmanuele.photos.filter(filled).slice(0, 3);
  }

  return children;
}

function mergeHomeContent(base: HomeContent, incoming: unknown): HomeContent {
  if (!incoming || typeof incoming !== "object") return base;

  const candidate = incoming as Partial<HomeContent>;
  // Le chiavi del vecchio formato non vengono riportate: restano solo quelle di HomeContent.
  const known = Object.fromEntries(Object.entries(candidate).filter(([key]) => key in base)) as Partial<HomeContent>;

  return {
    ...base,
    ...known,
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
      subtitle: candidate.auroraStory?.subtitle ?? base.auroraStory.subtitle,
      paragraphs: candidate.auroraStory?.paragraphs ?? base.auroraStory.paragraphs,
      pauseLine1: candidate.auroraStory?.pauseLine1 ?? base.auroraStory.pauseLine1,
      pauseLine2: candidate.auroraStory?.pauseLine2 ?? base.auroraStory.pauseLine2,
      parentsTitle: candidate.auroraStory?.parentsTitle ?? base.auroraStory.parentsTitle,
      parentsParagraphs: candidate.auroraStory?.parentsParagraphs ?? base.auroraStory.parentsParagraphs,
    },
    stories: {
      kicker: candidate.stories?.kicker ?? base.stories.kicker,
      titleLine1: candidate.stories?.titleLine1 ?? base.stories.titleLine1,
      titleLine2: candidate.stories?.titleLine2 ?? base.stories.titleLine2,
    },
    children: normalizeChildren(candidate.children) ?? migrateLegacyChildren(base.children, candidate as LegacyContent),
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
