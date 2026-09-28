const pillars = [
  {
    number: "01",
    title: "Famiglie",
    text: "Nessuno dovrebbe sentirsi solo davanti a una diagnosi, a una domanda o a un futuro da immaginare.",
  },
  {
    number: "02",
    title: "Bambini",
    text: "Prima di tutto persone: caratteri, desideri, talenti, capricci, risate e una vita intera da scrivere.",
  },
  {
    number: "03",
    title: "Autonomia",
    text: "Accompagnare senza sostituirsi. Dare strumenti, tempo e fiducia perché ogni possibilità possa diventare scelta.",
  },
  {
    number: "04",
    title: "Inclusione",
    text: "Una società è davvero inclusiva quando non chiede a qualcuno di dimostrare ogni giorno di meritare il proprio posto.",
  },
];

const stories = [
  { name: "Aurora", line: "Ho una luce tutta mia.", accent: "coral" },
  { name: "Lorenzo", line: "Mi piace scoprire come funzionano le cose.", accent: "sage" },
  { name: "Sofia", line: "Rido forte. E non chiedo permesso.", accent: "gold" },
];

const logoSrc = "/insieme-oltre-logo.png?v=logo-public-20260928";

function HeartLine() {
  return (
    <svg className="heart-line" viewBox="0 0 160 70" aria-hidden="true">
      <path d="M4 42C31 47 46 43 61 31c9-8 12-22 4-26-9-5-19 3-16 13 4 13 25 21 44 20 21-1 37-9 63-29" />
    </svg>
  );
}

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Insieme Oltre, torna all'inizio">
          <span className="brand-dot" aria-hidden="true">♥</span>
          <span>Insieme <em>Oltre</em></span>
        </a>
        <nav aria-label="Navigazione principale">
          <a href="#manifesto">Chi siamo</a>
          <a href="#cosa-facciamo">Cosa facciamo</a>
          <a href="#storie">Storie</a>
          <a href="#futuro">Il futuro</a>
        </nav>
        <a className="header-cta" href="#unisciti">Unisciti a noi</a>
      </header>

      <section className="hero" id="top">
        <div className="hero-noise" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">Famiglie. Persone. Possibilità.</p>
          <h1>
            L’amore non si misura
            <span>in cromosomi.</span>
          </h1>
          <p className="hero-lead">
            Una comunità che mette al centro i bambini, le loro possibilità e il loro futuro.
            Senza etichette. Senza pietismo. Insieme.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#manifesto">Scopri chi siamo <span>→</span></a>
            <a className="button button-ghost" href="#storie">Conosci le storie</a>
          </div>
          <div className="hand-note">Prima le persone. Sempre.</div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="sun-orbit orbit-one" />
          <div className="sun-orbit orbit-two" />
          <div className="portrait-halo logo-frame">
            <img
              className="hero-logo-img"
              src={logoSrc}
              alt=""
              width="1448"
              height="1086"
            />
          </div>
          <div className="hero-whisper">più ascolto<br/>più possibilità<br/><strong>più futuro</strong></div>
        </div>

        <a className="scroll-cue" href="#manifesto" aria-label="Scorri alla sezione successiva">
          <span>scorri</span><i>↓</i>
        </a>
      </section>

      <section className="manifesto section" id="manifesto">
        <div className="section-kicker">Il nostro punto di partenza</div>
        <div className="manifesto-grid">
          <h2>Prima vengono<br/><em>i bambini.</em></h2>
          <div className="manifesto-text">
            <p>
              Non “bambini speciali”. Non una diagnosi prima del nome. Bambini.
              Con passioni, capricci, sorrisi, paure, talenti e un futuro ancora tutto da scrivere.
            </p>
            <p>
              Crediamo in una comunità che non misuri una persona da ciò che le manca,
              ma dalle possibilità che insieme possiamo aprire.
            </p>
            <HeartLine />
          </div>
        </div>
      </section>

      <section className="pillars section" id="cosa-facciamo">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Quello che vogliamo costruire</p>
            <h2>Un posto dove<br/>sentirsi parte.</h2>
          </div>
          <p className="section-intro">
            Ascolto, strumenti concreti e occasioni vere. Per i bambini, per chi li accompagna e per il territorio che cresce con loro.
          </p>
        </div>
        <div className="pillar-grid">
          {pillars.map((pillar) => (
            <article className="pillar-card" key={pillar.title}>
              <span className="pillar-number">{pillar.number}</span>
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
              <span className="card-arrow" aria-hidden="true">↗</span>
            </article>
          ))}
        </div>
      </section>

      <section className="aurora-section section" id="storie">
        <div className="aurora-visual" aria-hidden="true">
          <div className="aurora-a">A</div>
          <span className="aurora-orbit aurora-orbit-one" />
          <span className="aurora-orbit aurora-orbit-two" />
          <span className="aurora-star">✦</span>
        </div>
        <div className="aurora-story">
          <p className="section-kicker light">Conosciamoci per nome</p>
          <h2>Aurora.</h2>
          <p className="aurora-subtitle">Prima di tutto, una bambina.</p>
          <p>
            Aurora non è arrivata nella nostra vita per insegnarci una lezione.
            <strong> È arrivata semplicemente per essere nostra figlia.</strong>
          </p>
          <p>
            Ha il suo carattere. I suoi tempi. Le sue conquiste. I sorrisi che riempiono una stanza
            e quel modo tutto suo di farsi capire.
          </p>
          <blockquote>
            “Se vuoi conoscere Aurora, contarle i cromosomi non servirà a molto.”
          </blockquote>
          <p className="aurora-closing">
            Il suo cromosoma in più appartiene alla sua storia.<br/>
            <strong>Ma non sarà mai tutta la sua storia.</strong>
          </p>
        </div>
      </section>

      <section className="stories section" aria-labelledby="stories-title">
        <div className="stories-title-wrap">
          <p className="section-kicker">Storie vere, vite intere</p>
          <h2 id="stories-title">Dietro ogni nome<br/>c’è un mondo.</h2>
        </div>
        <div className="story-grid">
          {stories.map((story, index) => (
            <article className={["story-card", story.accent].join(" ")} key={story.name}>
              <div className="story-number">0{index + 1}</div>
              <div className="story-avatar" aria-hidden="true">{story.name.charAt(0)}</div>
              <h3>{story.name}</h3>
              <p>“{story.line}”</p>
              <span>La sua storia arriverà qui →</span>
            </article>
          ))}
        </div>
      </section>

      <section className="numbers" id="futuro">
        <div className="numbers-inner">
          <div className="numbers-big" aria-label="46 oppure 47 cromosomi">
            <span>46</span><i>o</i><span>47</span>
          </div>
          <div className="numbers-copy">
            <h2>Cambia un numero.<br/><em>Non il valore.</em></h2>
            <p>
              Una persona non è una statistica, una previsione o una definizione.
              È relazioni, sogni, desideri, voce. È il proprio posto nel mondo.
            </p>
          </div>
        </div>
      </section>

      <section className="promise section">
        <p className="section-kicker">Il nostro impegno</p>
        <h2>
          Non vogliamo raccontare<br/>una diagnosi.
          <span>Vogliamo raccontare delle vite.</span>
        </h2>
        <p className="promise-note">
          Crescere. Sbagliare. Imparare. Fare amicizia. Sognare. Scegliere.
          Avere un posto nel mondo senza doverlo continuamente conquistare.
        </p>
      </section>

      <section className="join section" id="unisciti">
        <div className="join-symbol logo-frame-end">
          <img
            className="official-logo"
            src={logoSrc}
            alt="Insieme Oltre — L’amore non si misura in cromosomi"
            width="1448"
            height="1086"
          />
        </div>
        <div className="join-copy">
          <p className="section-kicker">Insieme, oltre</p>
          <h2>Il futuro non si aspetta.<br/><em>Si costruisce insieme.</em></h2>
          <p>
            Questo progetto nasce dalle famiglie e crescerà con le famiglie.
            Se condividi questa idea di futuro, c’è un posto anche per te.
          </p>
          <a className="button button-primary" href="#top">Cominciamo da qui <span>↑</span></a>
        </div>
      </section>

      <footer>
        <div className="footer-brand">
          <span>Insieme <em>Oltre</em></span>
          <small>L’amore non si misura in cromosomi.</small>
        </div>
        <p>Un progetto di famiglie, persone e possibilità.</p>
        <a href="#top">Torna su ↑</a>
      </footer>
    </main>
  );
}