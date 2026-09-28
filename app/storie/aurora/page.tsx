import type { Metadata } from "next";
import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import Link from "next/link";
import "./story.css";

const photoPath = "/aurora-storia.jpg";

export const metadata: Metadata = {
  title: "Aurora | Insieme Oltre",
  description: "Aurora è Aurora. La sua storia raccontata da mamma e papà.",
};

export default function AuroraStoryPage() {
  const hasPhoto = existsSync(join(process.cwd(), "public", "aurora-storia.jpg"));

  return (
    <main className="aurora-page">
      <header className="aurora-page-header">
        <Link href="/" className="aurora-page-brand">Insieme <em>Oltre</em></Link>
        <Link href="/#storie" className="aurora-page-back">← Torna alle storie</Link>
      </header>

      <article>
        {hasPhoto && (
          <div className="aurora-page-photo aurora-page-photo-opening">
            <Image src={photoPath} alt="Aurora" fill sizes="100vw" priority />
          </div>
        )}
        <section className="aurora-page-intro">
          <h1>Aurora</h1>
          <p>Prima di tutto, una bambina.</p>
        </section>

        <section className="aurora-page-prose">
          <p>Aurora non è arrivata nella nostra vita per insegnarci una lezione. È arrivata semplicemente per essere nostra figlia.</p>
          <p>E da quel momento è diventata una parte di noi che non sapevamo nemmeno ci mancasse.</p>
          <p>Ha il suo carattere. I suoi tempi. Le sue conquiste. Le giornate semplici e quelle più complicate. I sorrisi che riempiono una stanza e quel modo tutto suo di farsi capire.</p>
          <p>Aurora ha anche un cromosoma in più.<br/>Ma se vuoi conoscerla davvero, contarli non servirà a molto.</p>
          <p>Dovrai guardarla negli occhi. Dovrai aspettare il suo sorriso. Dovrai vederla andare incontro al mondo.</p>
          <p>Perché Aurora non è una diagnosi. Non è una percentuale. Non è una previsione scritta su un foglio.</p>
          <p className="aurora-page-declaration">Aurora è Aurora.<br/>Ed è la cosa più bella che ci sia mai accaduta.</p>
        </section>

        <section className="aurora-page-pause" aria-label="Una parte della sua storia">
          {hasPhoto && (
            <div className="aurora-page-photo aurora-page-photo-pause">
              <Image src={photoPath} alt="Aurora" fill sizes="(max-width: 620px) 100vw, 1000px" />
            </div>
          )}
          <p>Il suo cromosoma in più appartiene alla sua storia.<br/>Ma non sarà mai tutta la sua storia.</p>
        </section>

        <section className="aurora-page-parents">
          <h2>Quando è nata Aurora, è nata anche una nuova parte di noi.</h2>
          <p>Abbiamo conosciuto paure che prima non conoscevamo. Abbiamo imparato parole che non avremmo mai pensato di dover imparare. Abbiamo aspettato, sperato, festeggiato conquiste che per altri possono sembrare piccole.</p>
          <p>Ma soprattutto abbiamo scoperto una cosa molto più semplice:</p>
          <p className="aurora-page-declaration">non dovevamo imparare ad amare Aurora.<br/>Dovevamo soltanto conoscerla.</p>
          <p>Perché l’amore era già lì.</p>
        </section>
      </article>

      <footer className="aurora-page-footer">
        <Link href="/">Insieme Oltre</Link>
        <span>L’amore non si misura in cromosomi.</span>
      </footer>
    </main>
  );
}
