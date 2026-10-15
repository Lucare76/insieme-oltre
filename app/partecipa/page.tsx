import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { socialMetadata } from "../../lib/seo";
import { ParticipationForm } from "./ParticipationForm";
import "./partecipa.css";

export const metadata: Metadata = {
  title: "Partecipa alle idee | Insieme Oltre",
  description: "Aiutaci a scegliere le prime attività: incontri, laboratori, autonomia, sport e lavoro. Un piccolo questionario per tutte le età.",
  alternates: { canonical: "/partecipa" },
  ...socialMetadata({
    title: "Le tue idee per Insieme Oltre",
    description: "Raccontaci da dove vorresti cominciare, insieme.",
    path: "/partecipa",
  }),
};

export default function PartecipaPage() {
  return <main className="participa-page">
    <header className="participa-header">
      <Link href="/" aria-label="Torna alla homepage">
        <Image src="/insieme-oltre-logo.png" alt="Insieme Oltre" width={210} height={158} priority />
      </Link>
      <Link className="participa-home" href="/">← Torna al sito</Link>
    </header>
    <section className="participa-intro" aria-labelledby="participa-title">
      <p className="participa-kicker">Costruiamo i primi progetti insieme</p>
      <h1 id="participa-title">Da dove<br /><em>cominciamo?</em></h1>
      <p>Un'associazione diventa utile quando ascolta davvero. Dicci quali attività vorresti trovare in Insieme Oltre: le vostre indicazioni ci aiuteranno a scegliere le priorità.</p>
      <div className="participa-tags"><span>Per ogni età</span><span>Circa 2 minuti</span><span>Senza nome o email</span></div>
    </section>
    <section className="participa-form-wrap" aria-labelledby="partecipazione-form-title">
      <h2 id="partecipazione-form-title">La tua voce conta.</h2>
      <p>Non stiamo chiedendo un'iscrizione: raccogliamo soltanto idee e preferenze per organizzare le prime attività.</p>
      <ParticipationForm available privacyHref="/informativa-questionario" />
    </section>
    <footer className="participa-footer">
      <strong>Insieme Oltre</strong>
      <span>L'amore non si misura in cromosomi.</span>
      <Link href="/">Scopri l'associazione →</Link>
    </footer>
  </main>;
}
