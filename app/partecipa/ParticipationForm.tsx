"use client";

import { useRef, useState, type FormEvent } from "react";
import { ages, contributions, needs, obstacles, priorities, roles, times } from "../../lib/participation";

export function ParticipationForm({ available, privacyHref }: { available: boolean; privacyHref: string }) {
  const [role, setRole] = useState("familiare");
  const [age, setAge] = useState("tutte");
  const [interests, setInterests] = useState<string[]>([]);
  const [idea, setIdea] = useState("");
  const [need, setNeed] = useState("");
  const [timesSelected, setTimesSelected] = useState<string[]>([]);
  const [obstacle, setObstacle] = useState("");
  const [contribution, setContribution] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const sending = useRef(false);
  const [complete, setComplete] = useState(false);

  function changeInterest(id: string, checked: boolean) {
    setInterests((list) => checked ? (list.length < 3 ? [...list, id] : list) : list.filter((x) => x !== id));
  }

  function changeTime(id: string, checked: boolean) {
    setTimesSelected((list) => checked ? (list.length < 2 ? [...list, id] : list) : list.filter((x) => x !== id));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || !available || !privacy || interests.length < 1) return;
    sending.current = true;
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/partecipa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, age, interests, need, times: timesSelected, obstacle, contribution, idea: idea.trim(), privacy, website: "" }),
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => null);
      const message = payload?.message || "Non siamo riusciti a registrare la risposta.";
      setFeedback({ ok: response.ok, message });
      if (response.ok) setComplete(true);
    } catch { setFeedback({ ok: false, message: "Invio non confermato. Riprova più tardi." }); }
    finally { sending.current = false; setPending(false); }
  }

  if (complete) return <div className="participa-thanks" role="status"><div aria-hidden="true">♥</div><h3>Grazie di cuore!</h3><p>{feedback?.message}</p><p>Le idee più importanti diventano grandi quando le costruiamo insieme.</p><a href="/">Torna a Insieme Oltre →</a></div>;

  return <form className="participa-form" onSubmit={submit} aria-busy={pending}>
    <fieldset>
      <legend><span>01</span> Partecipo come...</legend>
      <div className="participa-choices">
        {roles.map((item) => <label key={item.value} className={role === item.value ? "selected" : ""}>
          <input type="radio" name="role" value={item.value} checked={role === item.value} onChange={() => setRole(item.value)} />
          {item.label}
        </label>)}
      </div>
    </fieldset>
    <fieldset>
      <legend><span>02</span> Quale fascia d'età ti interessa?</legend>
      <div className="participa-choices">
        {ages.map((item) => <label key={item.value} className={age === item.value ? "selected" : ""}>
          <input type="radio" name="age" value={item.value} checked={age === item.value} onChange={() => setAge(item.value)} />
          {item.label}
        </label>)}
      </div>
    </fieldset>
    <fieldset>
      <legend><span>03</span> Scegli fino a tre attività</legend>
      <p className="participa-hint">Seleziona da una a tre proposte. Non ci sono risposte giuste o sbagliate.</p>
      <div className="participa-activities">
        {priorities.map((item) => <label key={item.value} className={interests.includes(item.value) ? "selected" : ""}>
          <input type="checkbox" checked={interests.includes(item.value)}
            disabled={!interests.includes(item.value) && interests.length >= 3}
            onChange={(e) => changeInterest(item.value, e.target.checked)} />
          <span><strong>{item.title}</strong><small>{item.detail}</small></span>
        </label>)}
      </div>
      <p className="participa-hint" aria-live="polite">Selezionate: {interests.length} su 3</p>
    </fieldset>
    <fieldset>
      <legend><span>04</span> Qual è la difficoltà più importante da affrontare?</legend>
      <p className="participa-hint">Facoltativo. Ci aiuta a capire da dove cominciare.</p>
      <div className="participa-choices">
        {needs.map((item) => <label key={item.value} className={need === item.value ? "selected" : ""}>
          <input type="radio" name="need" value={item.value} checked={need === item.value} onChange={() => setNeed(item.value)} />
          {item.label}
        </label>)}
        <label className={need === "" ? "selected" : ""}><input type="radio" name="need" value="" checked={need === ""} onChange={() => setNeed("")} />Preferisco non rispondere</label>
      </div>
    </fieldset>
    <fieldset>
      <legend><span>05</span> Quando ti sarebbe più comodo partecipare?</legend>
      <p className="participa-hint">Facoltativo: puoi indicare fino a due momenti.</p>
      <div className="participa-choices">
        {times.map((item) => <label key={item.value} className={timesSelected.includes(item.value) ? "selected" : ""}>
          <input type="checkbox" checked={timesSelected.includes(item.value)}
            disabled={!timesSelected.includes(item.value) && timesSelected.length >= 2}
            onChange={(e) => changeTime(item.value, e.target.checked)} />
          {item.label}
        </label>)}
      </div>
    </fieldset>
    <fieldset>
      <legend><span>06</span> Cosa potrebbe rendere difficile partecipare?</legend>
      <p className="participa-hint">Facoltativo: scegli la difficoltà principale.</p>
      <div className="participa-choices">
        {obstacles.map((item) => <label key={item.value} className={obstacle === item.value ? "selected" : ""}>
          <input type="radio" name="obstacle" value={item.value} checked={obstacle === item.value} onChange={() => setObstacle(item.value)} />
          {item.label}
        </label>)}
        <label className={obstacle === "" ? "selected" : ""}><input type="radio" name="obstacle" value="" checked={obstacle === ""} onChange={() => setObstacle("")} />Preferisco non rispondere</label>
      </div>
    </fieldset>
    <fieldset>
      <legend><span>07</span> Ti piacerebbe contribuire all'associazione?</legend>
      <p className="participa-hint">Facoltativo. Non è un'iscrizione né un impegno: vogliamo capire le disponibilità.</p>
      <div className="participa-choices">
        {contributions.map((item) => <label key={item.value} className={contribution === item.value ? "selected" : ""}>
          <input type="radio" name="contribution" value={item.value} checked={contribution === item.value} onChange={() => setContribution(item.value)} />
          {item.label}
        </label>)}
        <label className={contribution === "" ? "selected" : ""}><input type="radio" name="contribution" value="" checked={contribution === ""} onChange={() => setContribution("")} />Preferisco non rispondere</label>
      </div>
    </fieldset>
    <fieldset>
      <legend><span>08</span> Vuoi aggiungere un'idea?</legend>
      <label className="participa-idea" htmlFor="participa-idea">Facoltativo: un suggerimento in poche parole.</label>
      <textarea id="participa-idea" rows={3} value={idea} onChange={(e) => setIdea(e.target.value)} maxLength={350}
        placeholder="Mi piacerebbe organizzare..." />
      <p className="participa-hint">Non inserire nomi, recapiti o informazioni sanitarie. {idea.length}/350 caratteri.</p>
    </fieldset>
    <div className="participa-consent">
      {available ? <label><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} required />
        <span>Ho letto l'<a href={privacyHref} target="_blank" rel="noreferrer">informativa sulla privacy</a> relativa a questo questionario.</span></label> :
        <p role="status">Stiamo completando l'informativa sulla privacy: potrai inviare il questionario non appena sarà pubblicata.</p>}
    </div>
    <button className="participa-submit" disabled={pending || !available || !privacy || interests.length < 1}>
      {pending ? "Invio in corso…" : "Invia le tue idee →"}
    </button>
    <div aria-live="polite">{feedback && <p className={feedback.ok ? "participa-success" : "participa-error"} role="status">{feedback.message}</p>}</div>
  </form>;
}
