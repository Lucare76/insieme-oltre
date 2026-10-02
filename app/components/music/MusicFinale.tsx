export function MusicFinale({ visible, slogan, storiesHref, joinHref }: {
  visible: boolean;
  slogan: string;
  storiesHref: string;
  joinHref: string;
}) {
  return (
    <div className={`music-finale${visible ? " is-visible" : ""}`} aria-hidden={!visible}>
      <p className="music-finale-brand">Insieme <em>Oltre</em></p>
      <p className="music-finale-slogan">{slogan}</p>
      <div className="music-finale-actions">
        <a className="button button-primary" href={storiesHref}>Conosci le nostre storie <span aria-hidden="true">→</span></a>
        <a className="button button-ghost" href={joinHref}>Entra in Insieme Oltre</a>
      </div>
    </div>
  );
}
