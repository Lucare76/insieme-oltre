import type { Metadata } from "next";
import Link from "next/link";
import { LegalLinks } from "../components/LegalLinks";
import { privacyPolicy } from "../../lib/legal";
import "../storie/aurora/story.css";
import "./legal.css";

export const metadata: Metadata = {
  title: "Cookie Policy | Insieme Oltre",
  description: "Come il sito di Insieme Oltre usa cookie e tecnologie simili: nessun cookie sul sito pubblico, nessun tracciamento, nessuna profilazione.",
  alternates: { canonical: "/cookie-policy" },
};

const notUsed = [
  "cookie pubblicitari;",
  "cookie di profilazione;",
  "cookie di remarketing;",
  "strumenti analytics di terze parti;",
  "pixel pubblicitari;",
  "social tracking;",
  "fingerprinting.",
];

const thirdParties = ["YouTube;", "Google Maps;", "Facebook;", "Instagram;", "X/Twitter;", "LinkedIn;", "servizi pubblicitari."];

export default function CookiePolicyPage() {
  return (
    <main className="aurora-page">
      <header className="aurora-page-header">
        <Link href="/" className="aurora-page-brand">Insieme <em>Oltre</em></Link>
        <Link href="/" className="aurora-page-back">← Torna al sito</Link>
      </header>

      <article className="legal">
        <header className="legal-intro">
          <p className="legal-kicker">Informazioni sul sito</p>
          <h1>Cookie Policy</h1>
          <p className="legal-lead">Informazioni sull’utilizzo di cookie e tecnologie similari</p>
        </header>

        <section className="legal-section">
          <p>
            Il sito web di <strong>Insieme Oltre</strong> è stato progettato limitando al minimo l’utilizzo di tecnologie di
            tracciamento e la raccolta di informazioni relative alla navigazione degli utenti.
          </p>
          <p className="legal-highlight">
            Attualmente il sito pubblico <strong>non utilizza cookie di profilazione, cookie pubblicitari, strumenti di
            remarketing o sistemi destinati alla creazione di profili degli utenti</strong>.
          </p>
          <p>
            Non vengono inoltre utilizzati strumenti di analisi statistica di terze parti, quali Google Analytics, né pixel
            pubblicitari o analoghi sistemi di tracciamento.
          </p>
        </section>

        <section className="legal-section">
          <h2>Cosa sono i cookie</h2>
          <p>I cookie sono piccoli file di testo che un sito web può memorizzare sul dispositivo dell’utente durante la navigazione.</p>
          <p>
            Possono essere utilizzati, ad esempio, per garantire il funzionamento di un servizio, mantenere una sessione
            autenticata, ricordare preferenze oppure raccogliere informazioni statistiche.
          </p>
          <p>
            La normativa distingue gli strumenti strettamente necessari al funzionamento del servizio da quelli utilizzati per
            finalità ulteriori, come analisi, profilazione o pubblicità.
          </p>
        </section>

        <section className="legal-section">
          <h2>Cookie utilizzati dal sito pubblico</h2>
          <p className="legal-highlight">
            Il sito pubblico di <strong>Insieme Oltre non installa attualmente cookie sul dispositivo del visitatore</strong>.
          </p>
          <p>Non vengono utilizzati:</p>
          <ul className="legal-list">
            {notUsed.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p>
            Di conseguenza, allo stato attuale, la navigazione del sito pubblico non richiede la visualizzazione di un banner per
            l’acquisizione del consenso ai cookie.
          </p>
        </section>

        <section className="legal-section">
          <h2>Font, immagini e contenuti multimediali</h2>
          <p>
            I caratteri utilizzati dal sito vengono gestiti tramite l’infrastruttura dell’applicazione e serviti direttamente dal
            dominio del sito.
          </p>
          <p>Durante la normale navigazione non vengono quindi effettuate richieste verso Google Fonts da parte del browser del visitatore.</p>
          <p>
            Le immagini e i contenuti audio utilizzati nelle pagine pubbliche sono anch’essi forniti direttamente dal sito e non
            comportano l’utilizzo di cookie o tecnologie di tracciamento di terze parti.
          </p>
        </section>

        <section className="legal-section">
          <h2>Area amministrativa</h2>
          <p>Il sito dispone di un’area riservata destinata esclusivamente agli amministratori autorizzati.</p>
          <p>
            Per consentire l’autenticazione e mantenere attiva la sessione dell’amministratore può essere utilizzato uno
            strumento di memorizzazione locale del browser.
          </p>
          <p>
            Tale tecnologia è utilizzata esclusivamente per consentire il funzionamento del servizio di autenticazione richiesto
            dall’utente amministratore e non viene utilizzata per finalità di profilazione, pubblicità o monitoraggio dei
            visitatori del sito pubblico.
          </p>
        </section>

        <section className="legal-section">
          <h2>Cookie e strumenti utilizzati</h2>
          <p>
            Sul sito pubblico: <strong>nessun cookie</strong> e nessun dato salvato nel localStorage o nel sessionStorage del
            browser. L’unico strumento di memorizzazione presente riguarda l’area amministrativa:
          </p>
          <div className="legal-table-wrap">
            <table className="legal-table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Fornitore</th>
                  <th scope="col">Finalità</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Durata</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" data-label="Nome"><code>insieme_oltre_admin_token</code></th>
                  <td data-label="Fornitore">Insieme Oltre (il token di accesso è emesso dal servizio di autenticazione Supabase)</td>
                  <td data-label="Finalità">Mantenere autenticato l’amministratore nell’area riservata</td>
                  <td data-label="Categoria">Tecnico, strettamente necessario. Non è un cookie: è un dato nel localStorage del browser, usato solo nell’area amministrativa</td>
                  <td data-label="Durata">Fino all’uscita dall’area riservata (“Esci”) o alla cancellazione dei dati del browser. Il token smette di essere valido alla scadenza fissata da Supabase Auth</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="legal-section">
          <h2>Servizi tecnici</h2>
          <p>Il sito è ospitato su infrastrutture tecniche necessarie alla sua erogazione.</p>
          <p>
            Tali servizi possono trattare dati tecnici indispensabili al funzionamento, alla sicurezza e alla trasmissione delle
            pagine web, secondo le rispettive condizioni e informative.
          </p>
          <p>Il sito non utilizza tali strumenti per creare profili commerciali dei visitatori.</p>
        </section>

        <section className="legal-section">
          <h2>Servizi di terze parti</h2>
          <p>Attualmente le pagine pubbliche non incorporano contenuti provenienti da servizi quali:</p>
          <ul className="legal-list">
            {thirdParties.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p>
            Qualora in futuro venissero introdotti servizi esterni che comportino l’utilizzo di cookie o altri strumenti di
            tracciamento non strettamente necessari, questa informativa sarà aggiornata e, ove richiesto dalla normativa, tali
            strumenti saranno attivati esclusivamente dopo l’acquisizione del consenso dell’utente.
          </p>
        </section>

        <section className="legal-section">
          <h2>Gestione dei cookie tramite il browser</h2>
          <p>
            L’utente può comunque visualizzare, gestire o eliminare eventuali cookie e dati memorizzati attraverso le impostazioni
            del proprio browser.
          </p>
          <p>Le modalità dipendono dal browser e dalla versione utilizzata.</p>
        </section>

        <section className="legal-section">
          <h2>Aggiornamenti</h2>
          <p>
            La presente Cookie Policy potrà essere aggiornata nel caso in cui vengano modificati i servizi, le funzionalità o le
            tecnologie utilizzate dal sito.
          </p>
          <p>La versione aggiornata sarà sempre disponibile su questa pagina.</p>
          <p className="legal-updated">Ultimo aggiornamento: ottobre 2026</p>
          <p>
            Per maggiori informazioni sul trattamento dei dati personali sarà disponibile anche la{" "}
            {privacyPolicy.published
              ? <Link href={privacyPolicy.href}><strong>Privacy Policy di Insieme Oltre</strong></Link>
              : <strong>Privacy Policy di Insieme Oltre</strong>}
            .
          </p>
        </section>
      </article>

      <footer className="aurora-page-footer">
        <Link href="/">Insieme Oltre</Link>
        <div className="aurora-page-footer-end">
          <span>L’amore non si misura in cromosomi.</span>
          <LegalLinks className="aurora-page-legal" />
        </div>
      </footer>
    </main>
  );
}
