import type { CSSProperties } from "react";
import {
  STORY_LINK_LABEL,
  STORY_PENDING_LABEL,
  charCount,
  childCardTitle,
  childInitial,
  isPublished,
  type ChildStory,
  type StoryAccent,
} from "../../lib/children";

/**
 * Variabili comuni a tutta la serie di card: il titolo più lungo decide la dimensione dei titoli
 * (così restano tutti su una riga) e un sottotitolo lungo riserva due righe a tutti.
 */
export function storyRowStyle(children: ChildStory[]): CSSProperties {
  const titleChars = Math.max(15, ...children.map((child) => charCount(childCardTitle(child))));
  const lineRows = children.some((child) => charCount(child.cardSubtitle) > 30) ? 2 : 1;
  return { "--story-title-chars": titleChars, "--story-line-rows": lineRows } as CSSProperties;
}

// Stessa struttura per tutte le card: cambia solo il contenuto, non l'impaginazione.
export function StoryCard({ child, accent, duplicate = false, preview = false }: {
  child: ChildStory;
  accent: StoryAccent;
  duplicate?: boolean;
  /** Nell'anteprima dell'admin il link non porta da nessuna parte. */
  preview?: boolean;
}) {
  const published = isPublished(child);

  return (
    <article className={`story-card ${accent}`} aria-hidden={duplicate || undefined}>
      <div className="story-avatar" aria-hidden="true">{childInitial(child)}</div>
      <h3>{childCardTitle(child)}</h3>
      <p className="story-line">{child.cardSubtitle}</p>
      <p className="story-description">{child.cardText}</p>
      {published && !preview
        ? <a className="story-link" href={`/storie/${child.slug}`} tabIndex={duplicate ? -1 : undefined}>{STORY_LINK_LABEL}</a>
        : <span className={published ? "story-link story-link-static" : "story-link story-link-pending"}>
          {published ? STORY_LINK_LABEL : STORY_PENDING_LABEL}
        </span>}
    </article>
  );
}
