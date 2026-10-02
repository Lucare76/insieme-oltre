/** Il finale emerge a passi (vedi finaleStep): nome, slogan e, solo a brano concluso, i pulsanti. */
export function MusicFinale({ step, slogan, storiesHref, joinHref }: {
  step: number;
  slogan: string;
  storiesHref: string;
  joinHref: string;
}) {
  const shown = (from: number) => (step >= from ? " is-shown" : "");

  return (
    <div className="music-finale" aria-hidden={step === 0}>
      <p className={`music-finale-brand${shown(1)}`}>Insieme <em>Oltre</em></p>
      <p className={`music-finale-slogan${shown(2)}`}>{slogan}</p>
      <div className={`music-finale-actions${shown(3)}`}>
        <a className="button button-primary" href={storiesHref}>Conosci le nostre storie <span aria-hidden="true">→</span></a>
        <a className="button button-ghost" href={joinHref}>Entra in Insieme Oltre</a>
      </div>
    </div>
  );
}
