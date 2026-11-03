import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { publicQuestionnaire } from "../../../lib/questionnaireServer";
import { QuestionnaireForm } from "./QuestionnaireForm";
import "../../partecipa/partecipa.css";
import "./q.css";

type Props = { params: Promise<{ token: string }> };

// Il link contiene il token della sessione: mai indicizzato né trasmesso come referrer.
export const metadata: Metadata = {
  title: "Questionario | Insieme Oltre",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default async function QuestionnairePage({ params }: Props) {
  const { token } = await params;
  const q = await publicQuestionnaire(token).catch(() => undefined);
  if (q === null) notFound();
  return (
    <main className="participa-page qs-page">
      <header className="participa-header">
        <Image src="/insieme-oltre-logo.png" alt="Insieme Oltre" width={210} height={158} priority />
      </header>
      {!q ? (
        <section className="participa-form-wrap">
          <h1 className="qs-title">Servizio momentaneamente non disponibile</h1>
          <p>Riprova tra qualche minuto ricaricando la pagina.</p>
        </section>
      ) : (
        <>
          <section className="participa-intro qs-intro">
            <p className="participa-kicker">{q.sessionLabel}</p>
            <h1 className="qs-title">{q.title}</h1>
            {q.description && <p className="qs-description">{q.description}</p>}
            <div className="participa-tags">
              <span>Anonimo</span>
              <span>Senza registrazione</span>
              <span>{q.questions.length} {q.questions.length === 1 ? "domanda" : "domande"}</span>
            </div>
          </section>
          <section className="participa-form-wrap">
            {q.open ? (
              <QuestionnaireForm questions={q.questions} token={token} retentionMonths={q.retention_months} />
            ) : (
              <div className="participa-thanks" role="status">
                <h2>Questionario chiuso</h2>
                <p>Questa sessione non accetta più risposte. Grazie per l’interesse.</p>
              </div>
            )}
          </section>
        </>
      )}
      <footer className="participa-footer">
        <strong>Insieme Oltre</strong>
        <span>L&apos;amore non si misura in cromosomi.</span>
      </footer>
    </main>
  );
}
