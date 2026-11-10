/** Normalizza soltanto i nomi delle persone, senza alterare email, ID o campi liberi. */
export function uppercasePersonName(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleUpperCase("it-IT");
}
