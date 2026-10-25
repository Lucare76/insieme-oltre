import { parseCents, validDate, type Movement } from "./accounting";

export type ReceiptIncome = Pick<
  Movement,
  | "date"
  | "kind"
  | "amount_cents"
  | "account"
  | "category"
  | "project"
  | "description"
> & { private_note: string };
export function receiptIncome(body: Record<string, unknown>): ReceiptIncome {
  const cents = parseCents(body.amount);
  if (!cents || !validDate(body.date))
    throw new Error("Verifica importo e data dell’incasso.");
  if (
    typeof body.project !== "string" ||
    body.project.trim().length > 120 ||
    /[\u0000-\u001f\u007f]/.test(body.project)
  )
    throw new Error("Verifica il nome del progetto o dell’iniziativa.");
  if (typeof body.description !== "string")
    throw new Error("Inserisci la causale.");
  return {
    date: body.date,
    kind: "income",
    amount_cents: cents,
    account: body.payment === "cash" ? "cash" : "bank",
    category: body.type === "donation" ? "Donazioni" : "Raccolta fondi",
    project: body.project.trim(),
    description: body.description.trim(),
    private_note: "",
  };
}

export type ReceiptData = {
  type: "donation" | "fundraising";
  name: string;
  tax_code: string;
  address: string;
  email: string;
  description: string;
  payment: "bank_transfer" | "cash" | "card";
  reference: string;
};
export type Issuer = {
  name: string;
  tax_code: string;
  address: string;
  representative: string;
};
export type Receipt = {
  id: string;
  number: number;
  issued_on: string;
  movement_id: string;
  data: ReceiptData;
  issuer: Issuer;
  amount_cents: number;
  payment_date: string;
  cancelled: boolean;
  cancellation_reason: string | null;
  mail_status: "pending" | "sending" | "sent" | "unknown";
  sent_at: string | null;
};
export const receiptTitle = (type: ReceiptData["type"]) =>
  type === "donation"
    ? "Ricevuta di erogazione liberale"
    : "Ricevuta di partecipazione alla raccolta fondi";
export function receiptData(
  body: Record<string, unknown>,
  movement: Pick<Movement, "kind" | "cancelled" | "date" | "account">,
): ReceiptData {
  const field = (key: string, max: number, required = true) => {
    const value = body[key];
    if (
      typeof value !== "string" ||
      value.trim().length > max ||
      (required && !value.trim()) ||
      /[\u0000-\u001f\u007f]/u.test(value)
    )
      throw new Error("Compila correttamente i dati del versante.");
    return value.trim();
  };
  if (
    movement.kind !== "income" ||
    movement.cancelled ||
    !validDate(movement.date)
  )
    throw new Error(
      "Seleziona un’entrata effettivamente incassata e non annullata.",
    );
  if (!["donation", "fundraising"].includes(String(body.type)))
    throw new Error("Scegli il tipo di ricevuta.");
  const payment = field("payment", 20) as ReceiptData["payment"];
  if (
    !["bank_transfer", "cash", "card"].includes(payment) ||
    (payment === "cash") !== (movement.account === "cash")
  )
    throw new Error(
      "Il metodo di pagamento deve corrispondere al conto del movimento.",
    );
  const email = field("email", 254).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Indirizzo email non valido.");
  const tax_code = field("tax_code", 16, false).toUpperCase();
  if (tax_code && !/^(?:[0-9]{11}|[A-Z0-9]{16})$/.test(tax_code))
    throw new Error("Verifica codice fiscale o partita IVA.");
  return {
    type: body.type as ReceiptData["type"],
    name: field("name", 120),
    tax_code,
    address: field("address", 240, false),
    email,
    description: field("description", 400),
    payment,
    reference: field("reference", 120, payment !== "cash"),
  };
}
export const paymentLabel = (value: ReceiptData["payment"]) =>
  ({ bank_transfer: "Bonifico bancario", cash: "Contanti", card: "Carta" })[
    value
  ];
