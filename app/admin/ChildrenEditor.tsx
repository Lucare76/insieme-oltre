"use client";

import { useState } from "react";
import { StoryCard, storyRowStyle } from "../components/StoryCard";
import {
  CHILD_LIMITS,
  STORY_LINK_LABEL,
  STORY_PENDING_LABEL,
  charCount,
  childAccent,
  childCardTitle,
  childInitial,
  childIssues,
  hasDedicatedPage,
  newChild,
  slugify,
  type ChildIssue,
  type ChildStory,
} from "../../lib/children";

function Field({ label, value, onChange, issues, limit, counted, multiline = false, tall = false, placeholder, hint, maxLength }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  issues: ChildIssue[];
  limit?: number;
  /** Testo da contare se diverso dal valore (es. titolo automatico). */
  counted?: string;
  multiline?: boolean;
  tall?: boolean;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
}) {
  const count = charCount(counted ?? value);

  return (
    <label className="admin-field">
      <span className="admin-field-label">
        {label}
        {limit !== undefined && <span className={count > limit ? "admin-count over" : "admin-count"}>{count}/{limit}</span>}
      </span>
      {multiline
        ? <textarea className={tall ? "admin-textarea-tall" : undefined} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        : <input value={value} placeholder={placeholder} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />}
      {hint && <small className="admin-hint">{hint}</small>}
      {issues.map((issue) => <small className={`admin-issue ${issue.level}`} key={issue.message}>{issue.message}</small>)}
    </label>
  );
}

export function ChildrenEditor({ items, onChange }: { items: ChildStory[]; onChange: (items: ChildStory[]) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const selectedIndex = items.findIndex((item) => item.id === selectedId);
  const child = selectedIndex >= 0 ? items[selectedIndex] : null;
  const pending = child?.status === "in_arrivo";
  const issues = child ? childIssues(child, items) : [];
  const issuesFor = (field: keyof ChildStory) => issues.filter((issue) => issue.field === field);

  function update(patch: Partial<ChildStory>) {
    onChange(items.map((item, index) => (index === selectedIndex ? { ...item, ...patch } : item)));
  }

  function rename(name: string) {
    if (!child) return;
    // Lo slug segue il nome finché non viene modificato a mano.
    const followsName = !child.slug || child.slug === slugify(child.name);
    update({ name, ...(followsName ? { slug: slugify(name) } : {}) });
  }

  function setPhoto(position: number, path: string) {
    if (!child) return;
    const photos = Array.from({ length: CHILD_LIMITS.photos }, (_, index) => (index === position ? path : child.photos[index] ?? ""));
    while (photos.length && !photos[photos.length - 1].trim()) photos.pop();
    update({ photos });
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function add() {
    const created = newChild();
    onChange([...items, created]);
    setSelectedId(created.id);
  }

  function remove(index: number) {
    if (!window.confirm(`Rimuovere ${items[index].name || "questo bambino"} dall’elenco?`)) return;
    const next = items.filter((_, itemIndex) => itemIndex !== index);
    onChange(next);
    setSelectedId(next[Math.max(0, index - 1)]?.id ?? null);
  }

  return (
    <section className="admin-children" aria-labelledby="admin-children-title">
      <div className="admin-children-heading">
        <div>
          <h2 id="admin-children-title">Bambini e storie</h2>
          <p>L’ordine dell’elenco è l’ordine delle card in homepage. Ogni card usa la stessa impaginazione.</p>
        </div>
        <button type="button" onClick={add}>Aggiungi bambino</button>
      </div>

      <div className="admin-children-layout">
        <ol className="admin-children-list">
          {items.map((item, index) => {
            const itemErrors = childIssues(item, items).filter((issue) => issue.level === "error").length;
            return (
              <li key={item.id} className={item.id === selectedId ? "selected" : undefined}>
                <button type="button" className="admin-child-select" onClick={() => setSelectedId(item.id)} aria-current={item.id === selectedId || undefined}>
                  <span className="admin-child-initial" aria-hidden="true">{childInitial(item) || "?"}</span>
                  <span className="admin-child-name">{item.name || "Senza nome"}</span>
                  <span className={`admin-child-status ${item.status}`}>{item.status === "pubblicata" ? "Pubblicata" : "In arrivo"}</span>
                  {itemErrors > 0 && <span className="admin-child-errors">{itemErrors} da correggere</span>}
                </button>
                <span className="admin-child-order">
                  <button type="button" className="secondary" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Sposta ${item.name} più su`}>↑</button>
                  <button type="button" className="secondary" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label={`Sposta ${item.name} più giù`}>↓</button>
                </span>
              </li>
            );
          })}
        </ol>

        {child ? (
          <div className="admin-child-editor">
            <div className="admin-child-preview" style={storyRowStyle(items)}>
              <span className="admin-field-label">Anteprima card (posizione {selectedIndex + 1})</span>
              <div className="admin-child-preview-row">
                <StoryCard child={child} accent={childAccent(selectedIndex)} preview />
              </div>
            </div>

            <fieldset>
              <legend>Card in homepage</legend>
              <Field label="Nome bambino" value={child.name} onChange={rename} issues={issuesFor("name")} />
              <Field label="Iniziale" value={child.initial} onChange={(initial) => update({ initial })} issues={issuesFor("initial")}
                maxLength={2} placeholder={childInitial({ ...child, initial: "" }) || "Automatica dal nome"}
                hint="Vuota = prima lettera del nome." />
              <Field label="Titolo card" value={child.cardTitle} onChange={(cardTitle) => update({ cardTitle })} issues={issuesFor("cardTitle")}
                limit={CHILD_LIMITS.cardTitle} counted={childCardTitle(child)} placeholder={childCardTitle({ ...child, cardTitle: "" })}
                hint="Vuoto = «Io sono Nome.». Resta sempre su una riga." />
              <Field label="Sottotitolo card" value={child.cardSubtitle} onChange={(cardSubtitle) => update({ cardSubtitle })}
                issues={issuesFor("cardSubtitle")} limit={CHILD_LIMITS.cardSubtitle} />
              <Field label="Testo introduttivo card" value={child.cardText} onChange={(cardText) => update({ cardText })}
                issues={issuesFor("cardText")} limit={CHILD_LIMITS.cardText} multiline />
            </fieldset>

            <fieldset>
              <legend>Storia</legend>
              <div className="admin-status" role="radiogroup" aria-label="Stato storia">
                <label><input type="radio" name="child-status" checked={child.status === "pubblicata"} onChange={() => update({ status: "pubblicata" })} /> Pubblicata</label>
                <label><input type="radio" name="child-status" checked={child.status === "in_arrivo"} onChange={() => update({ status: "in_arrivo" })} /> In arrivo</label>
              </div>
              <small className="admin-hint">
                {child.status === "pubblicata"
                  ? `La card mostra «${STORY_LINK_LABEL}» verso /storie/${child.slug || "…"}.`
                  : `La card mostra «${STORY_PENDING_LABEL}», non cliccabile.`}
              </small>
              <Field label={`Slug pagina storia${pending ? " (facoltativo)" : ""}`} value={child.slug} onChange={(slug) => update({ slug: slug.trim() })} issues={issuesFor("slug")}
                placeholder={slugify(child.name)} hint={`Indirizzo: /storie/${child.slug || slugify(child.name) || "…"}`} />
              {hasDedicatedPage(child) ? (
                <p className="admin-hint">La pagina di {child.name} è quella originale, con impaginazione dedicata: il testo si modifica nei campi «Storia di Aurora» qui sopra.</p>
              ) : (
                <>
                  {pending && <p className="admin-hint">Per una storia in arrivo i campi qui sotto sono facoltativi: diventano obbligatori quando scegli «Pubblicata».</p>}
                  <Field label={`Titolo pagina storia${pending ? " (facoltativo)" : ""}`} value={child.storyTitle} onChange={(storyTitle) => update({ storyTitle })}
                    issues={issuesFor("storyTitle")} limit={CHILD_LIMITS.storyTitle} />
                  <Field label={`Testo completo storia${pending ? " (facoltativo)" : ""}`} value={child.storyText} onChange={(storyText) => update({ storyText })}
                    issues={issuesFor("storyText")} multiline tall
                    hint={`${charCount(child.storyText.trim())} caratteri (consigliati ${CHILD_LIMITS.storyTextMin}–${CHILD_LIMITS.storyTextMax}). Lascia una riga vuota tra un paragrafo e l’altro; l’ultimo paragrafo diventa la frase finale in evidenza.`} />
                  {Array.from({ length: CHILD_LIMITS.photos }, (_, index) => (
                    <Field key={index} label={`Foto ${index + 1} (facoltativa)`} value={child.photos[index] ?? ""} onChange={(path) => setPhoto(index, path)}
                      issues={index === 0 ? issuesFor("photos") : []} placeholder={`/${child.slug || "nome"}-storia${index ? `-${index + 1}` : ""}.jpg`}
                      hint={index === 0 ? "Percorso di un file nella cartella public. La prima apre la pagina, le altre formano la galleria." : undefined} />
                  ))}
                </>
              )}
            </fieldset>

            <button type="button" className="secondary" onClick={() => remove(selectedIndex)}>Rimuovi {child.name || "bambino"}</button>
          </div>
        ) : (
          <p className="admin-hint">Seleziona un bambino dall’elenco o aggiungine uno nuovo.</p>
        )}
      </div>
    </section>
  );
}
