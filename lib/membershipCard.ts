export type CardPerson = { admitted_on?: string; ended_on?: string | null };

export function todayInRome() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
}

export function membershipCardCode(personId: string) {
  return "IO-" + personId.replace(/-/g, "").slice(0, 12).toUpperCase();
}

export function canIssueMembershipCard(person: CardPerson, year: number, today: string) {
  if (!Number.isInteger(year) || year < Number(today.slice(0, 4))) return false;
  if (!person.admitted_on || person.admitted_on > today) return false;
  if (person.ended_on && person.ended_on < today) return false;
  if (person.ended_on && person.ended_on < String(year) + "-01-01") return false;
  return true;
}

export function isMembershipCardValid(person: CardPerson | null, year: number, today: string) {
  return Boolean(
    person &&
    Number(today.slice(0, 4)) === year &&
    person.admitted_on &&
    person.admitted_on <= today &&
    (!person.ended_on || person.ended_on >= today)
  );
}
