"use client";
import { useEffect, useRef, useState } from "react";
import { retentionText, type AnswerInput, type QsQuestion } from "../../../lib/questionnaires";

type Values = Record<string, { options: string[]; text: string }>;
const DRAFT_HOURS = 24;
const draftKey = (token: string) => "insieme_qs_draft_" + token;

/** Form pubblico. In anteprima (senza token) non salva e non invia nulla. */
export function QuestionnaireForm({
  questions,
  token,
  retentionMonths,
}: {
  questions: QsQuestion[];
  token?: string;
  retentionMonths: number | null;
}) {
  const [values, setValues] = useState<Values>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "closed">("idle");
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);
  const clientKey = useRef("");
  const loaded = useRef(false);

  // Recupero delle risposte non inviate: solo su questo dispositivo, con scadenza.
  useEffect(() => {
    if (!token) return;
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey(token)) || "null");
      if (saved && saved.expires > Date.now() && saved.values) {
        clientKey.current = saved.client_key;
        queueMicrotask(() => {
          setValues(saved.values);
          setRestored(true);
        });
      } else localStorage.removeItem(draftKey(token));
    } catch {
      localStorage.removeItem(draftKey(token));
    }
    clientKey.current ||= crypto.randomUUID();
    loaded.current = true;
  }, [token]);
  useEffect(() => {
    if (!token || !loaded.current || state === "done") return;
    const filled = Object.values(values).some((v) => v.options.length || v.text.trim());
    try {
      if (filled)
        localStorage.setItem(
          draftKey(token),
          JSON.stringify({ expires: Date.now() + DRAFT_HOURS * 3600000, client_key: clientKey.current, values }),
        );
      else localStorage.removeItem(draftKey(token));
    } catch {
      /* Memoria del browser piena o disattivata: il form funziona comunque. */
    }
  }, [values, token, state]);

  const value = (id: string) => values[id] ?? { options: [], text: "" };
  function update(id: string, next: Partial<Values[string]>) {
    setValues((current) => ({ ...current, [id]: { ...value(id), ...current[id], ...next } }));
    setMissing((current) => current.filter((x) => x !== id));
  }
  function clearDraft() {
    if (token) localStorage.removeItem(draftKey(token));
    clientKey.current = crypto.randomUUID();
    setValues({});
    setRestored(false);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "sending") return;
    const website = String(new FormData(event.currentTarget as HTMLFormElement).get("website") ?? "");
    const empty = questions
      .filter((q) => q.required && !(q.kind === "text" ? value(q.id).text.trim() : value(q.id).options.length))
      .map((q) => q.id);
    setMissing(empty);
    if (empty.length) {
      setError(`Mancano ${empty.length === 1 ? "una risposta obbligatoria" : empty.length + " risposte obbligatorie"}.`);
      document.getElementById("qs-q-" + empty[0])?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!token) {
      setError("Anteprima: le risposte non vengono inviate.");
      return;
    }
    setState("sending");
    setError("");
    const answers: AnswerInput = {};
    for (const q of questions) {
      const v = value(q.id);
      answers[q.id] = q.kind === "text" ? { text: v.text } : { options: v.options };
    }
    try {
      const response = await fetch("/api/q/" + token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_key: clientKey.current, answers, website }),
        signal: AbortSignal.timeout(30000),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 410) {
        setState("closed");
        return;
      }
      if (!response.ok) throw new Error(payload.error);
      localStorage.removeItem(draftKey(token));
      setState("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setState("idle");
      setError(
        (e instanceof Error && e.message) ||
          "Invio non riuscito. Le risposte restano salvate su questo dispositivo: controlla la connessione e riprova.",
      );
    }
  }

  if (state === "done")
    return (
      <div className="participa-thanks" role="status">
        <div aria-hidden="true">♥</div>
        <h3>Grazie!</h3>
        <p>Le tue risposte sono state inviate correttamente.</p>
        <p>Puoi chiudere questa pagina.</p>
      </div>
    );
  if (state === "closed")
    return (
      <div className="participa-thanks" role="status">
        <h3>Questionario chiuso</h3>
        <p>Questa sessione non accetta più risposte. Le tue risposte restano salvate su questo dispositivo per 24 ore.</p>
      </div>
    );
  return (
    <form className="participa-form qs-form" onSubmit={submit} aria-busy={state === "sending"} noValidate>
      {restored && (
        <p className="qs-restored" role="status">
          Abbiamo recuperato le risposte non ancora inviate.{" "}
          <button type="button" onClick={clearDraft}>Ricomincia da capo</button>
        </p>
      )}
      {questions.map((q, n) => {
        const v = value(q.id);
        const invalid = missing.includes(q.id);
        const hintId = `qs-h-${q.id}`;
        return (
          <fieldset key={q.id} id={"qs-q-" + q.id} className={invalid ? "qs-invalid" : undefined} aria-describedby={hintId}>
            <legend>
              <span>{String(n + 1).padStart(2, "0")}</span> {q.prompt}
              {q.required && <b className="qs-required" aria-label="obbligatoria"> *</b>}
            </legend>
            <p className="participa-hint" id={hintId}>
              {q.help && <>{q.help} </>}
              {q.kind === "multiple" ? "Puoi scegliere più risposte." : q.kind === "single" ? "Scegli una risposta." : ""}
              {!q.required && " Facoltativa."}
            </p>
            {q.kind === "text" ? (
              <textarea
                aria-label={q.prompt}
                aria-invalid={invalid}
                value={v.text}
                rows={4}
                onChange={(e) => update(q.id, { text: e.target.value })}
                placeholder="Scrivi qui la tua risposta…"
              />
            ) : (
              <div className="participa-choices qs-choices">
                {q.options.map((o) => {
                  const checked = v.options.includes(o.id);
                  return (
                    <label key={o.id} className={checked ? "selected" : ""}>
                      <input
                        type={q.kind === "single" ? "radio" : "checkbox"}
                        name={q.id}
                        checked={checked}
                        onChange={(e) =>
                          update(q.id, {
                            options:
                              q.kind === "single"
                                ? [o.id]
                                : e.target.checked
                                  ? [...v.options, o.id]
                                  : v.options.filter((x) => x !== o.id),
                          })
                        }
                      />
                      {o.label}
                    </label>
                  );
                })}
                {q.kind === "single" && !q.required && v.options.length > 0 && (
                  <button type="button" className="qs-clear" onClick={() => update(q.id, { options: [] })}>
                    Togli la risposta
                  </button>
                )}
              </div>
            )}
            {invalid && <p className="participa-error">Questa risposta è obbligatoria.</p>}
          </fieldset>
        );
      })}
      <details className="qs-notice">
        <summary>Come trattiamo le tue risposte</summary>
        <p>
          Il questionario è organizzato da Insieme Oltre ODV per l’incontro a cui partecipi. Non chiediamo nome, email o
          account e non salviamo l’indirizzo IP con le risposte. Le risposte sono lette solo dalla professionista che
          conduce l’incontro e dalle persone autorizzate dell’associazione, per preparare e migliorare le attività.
        </p>
        <p>
          La compilazione è anonima, ma un testo libero può contenere elementi che permettono di riconoscerti: evita
          nomi, recapiti o dettagli su altre persone. Puoi lasciare vuote le domande facoltative. {retentionText(retentionMonths)}
        </p>
        <p>
          Finché non invii, le risposte restano salvate solo su questo dispositivo per {DRAFT_HOURS} ore, per non
          perderle se la pagina si chiude. Dopo l’invio vengono cancellate dal dispositivo. Per informazioni o per
          esercitare i tuoi diritti: <a href="mailto:info@insiemeoltreischia.it">info@insiemeoltreischia.it</a> ·{" "}
          <a href="/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</a>.
        </p>
      </details>
      <div className="participa-consent">
        <label>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
          <span>Ho letto come vengono trattate le risposte e acconsento al loro utilizzo per le attività dell’incontro.</span>
        </label>
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="qs-hp" aria-hidden="true" />
      {error && <p className="participa-error qs-error" role="alert">{error}</p>}
      <button className="participa-submit" disabled={state === "sending" || !consent}>
        {state === "sending" ? "Invio in corso…" : "Invia le risposte"}
      </button>
    </form>
  );
}
