export type AssociationRole = "owner" | "accountant" | "member";
export type Movement = {
  id: string;
  date: string;
  kind: "income" | "expense" | "transfer" | "opening";
  amount_cents: number;
  account: "cash" | "bank";
  category: string;
  project: string;
  description: string;
  version: number;
  cancelled: boolean;
  cancellation_reason: string | null;
};
export const kindLabels = {
  income: "Entrata",
  expense: "Uscita",
  transfer: "Trasferimento",
  opening: "Saldo iniziale",
};
export const roleLabels = {
  owner: "Admin principale",
  accountant: "Amministratore contabile",
  member: "Socio",
};
export const categories = [
  "Quote associative",
  "Donazioni",
  "Raccolta fondi",
  "Contributi",
  "Assicurazione",
  "Materiali",
  "Attività",
  "Sito e servizi",
  "Spese bancarie",
  "Altro",
];
export function parseCents(value: unknown): number | null {
  if (
    typeof value !== "string" ||
    !/^\d{1,8}([.,]\d{1,2})?$/.test(value.trim())
  )
    return null;
  const [whole, decimal = ""] = value.trim().replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return cents > 0 && Number.isSafeInteger(cents) ? cents : null;
}
export function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) >= 2000 &&
    Number(value.slice(0, 4)) <= 2199 &&
    new Date(value + "T12:00:00Z").toJSON()?.slice(0, 10) === value
  );
}
export function balances(items: Movement[]) {
  const result = { income: 0, expense: 0, cash: 0, bank: 0 };
  for (const item of items) {
    if (item.cancelled) continue;
    if (item.kind === "income") result.income += item.amount_cents;
    if (item.kind === "expense") result.expense += item.amount_cents;
    result[item.account] +=
      item.kind === "expense" || item.kind === "transfer"
        ? -item.amount_cents
        : item.amount_cents;
    if (item.kind === "transfer")
      result[item.account === "cash" ? "bank" : "cash"] += item.amount_cents;
  }
  return result;
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return (
    '"' +
    (/^[=+\-@\t\r\n]/.test(text.trimStart()) ? "'" : "") +
    text.replace(/"/g, '""') +
    '"'
  );
}
