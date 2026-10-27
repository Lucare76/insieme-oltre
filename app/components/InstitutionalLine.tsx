/** Dati istituzionali nei footer. Ogni dato resta intero: su mobile si va a capo solo dopo un separatore. */
const items = ["Insieme Oltre ODV", "C.F. 91019080638", "Via Rosato 4, 80072 Barano d’Ischia (NA)"];
const pec = "insiemeoltreodv@pec.it";

export function InstitutionalLine({ className }: { className?: string }) {
  return (
    <div className={className}>
      {items.map((item, index) => (
        <span key={item}>
          {index > 0 && " · "}
          <span className="nowrap">{item}</span>
        </span>
      ))}
      <span>
        {" · "}
        <span className="nowrap">PEC: <a href={`mailto:${pec}`}>{pec}</a></span>
      </span>
    </div>
  );
}
