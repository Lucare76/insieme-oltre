import { association, associationAddress } from "../../lib/association";

/** Riga istituzionale dei footer. Ogni dato resta intero: su mobile si va a capo solo dopo un separatore. */
export function InstitutionalLine({ className }: { className?: string }) {
  const items = [association.name, `C.F. ${association.taxCode}`, associationAddress];

  return (
    <p className={className}>
      {items.map((item) => (
        <span key={item}><span className="nowrap">{item}</span>{" · "}</span>
      ))}
      <a className="nowrap" href={`mailto:${association.email}`}>{association.email}</a>
    </p>
  );
}
