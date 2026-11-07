import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type FeeReceipt = {
  id: string;
  full_name: string;
  fiscal_code?: string | null;
  fee_year: number;
  amount_cents: number;
  paid_on: string;
  payment_account: "bank" | "cash";
  created_at: string;
};

/** La ricevuta è relativa ad una quota già incassata, non ad una donazione. */
export async function membershipFeePdf(fee: FeeReceipt): Promise<Buffer> {
  const issuer = {
    name: process.env.RECEIPT_ISSUER_NAME?.trim() ?? "",
    tax_code: process.env.RECEIPT_ISSUER_TAX_CODE?.trim() ?? "",
    address: process.env.RECEIPT_ISSUER_ADDRESS?.trim() ?? "",
    representative: process.env.RECEIPT_ISSUER_REPRESENTATIVE?.trim() ?? "",
  };
  if (
    !issuer.name || issuer.name.length > 240 ||
    !/^\d{11}$/.test(issuer.tax_code) ||
    !issuer.address || issuer.address.length > 240 ||
    /[\u0000-\u001f]/.test(issuer.name + issuer.address)
  ) throw new Error("Dati dell'associazione incompleti: configura RECEIPT_ISSUER_NAME, RECEIPT_ISSUER_TAX_CODE e RECEIPT_ISSUER_ADDRESS su Vercel.");

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const asset = (name: string) => readFile(path.join(process.cwd(), "lib/receipt-assets", name));
  const [regularBytes, boldBytes, logoBytes] = await Promise.all([
    asset("DejaVuSans.ttf"), asset("DejaVuSans-Bold.ttf"), asset("logo.png"),
  ]);
  const normal = await pdf.embedFont(regularBytes, { subset: true });
  const bold = await pdf.embedFont(boldBytes, { subset: true });
  const logo = await pdf.embedPng(logoBytes);
  const page = pdf.addPage([595.28, 841.89]);
  const color = rgb(0.14, 0.23, 0.18);
  const muted = rgb(0.39, 0.46, 0.42);
  const euros = (fee.amount_cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  const date = (s: string) => s.slice(0, 10).split("-").reverse().join("/");
  const issuedOn = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date(fee.created_at));
  // Il numero è stabile e univoco (UUID completo del versamento); non è una
  // numerazione progressiva fiscale né un nuovo documento contabile.
  const receiptNumber = "QA/" + fee.fee_year + "/" + fee.id.toUpperCase();
  let y = 678;
  function line(value: string, size = 11, strong = false, gap = 0) {
    const font = strong ? bold : normal;
    const text = value.replace(/[\u0000-\u001f]/g, " ").trim();
    let row = "";
    const draw = (part: string) => {
      if (y < 100) throw new Error("Ricevuta troppo lunga da impaginare.");
      page.drawText(part, { x: 51, y, size, font, color });
      y -= size * 1.48;
    };
    for (const char of text) {
      if (font.widthOfTextAtSize(row + char, size) > 485 && row) {
        draw(row);
        row = char;
      } else row += char;
    }
    if (row) draw(row);
    y -= gap;
  }
  const dims = logo.scale(Math.min(128 / logo.width, 80 / logo.height));
  page.drawImage(logo, { x: 51, y: 728, ...dims });
  page.drawText("RICEVUTA QUOTA ASSOCIATIVA", { x: 206, y: 781, size: 15, font: bold, color });
  page.drawText("Documento non fiscale", { x: 206, y: 755, size: 10, font: normal, color: muted });
  page.drawLine({ start: { x: 51, y: 711 }, end: { x: 544, y: 711 }, thickness: 1, color: rgb(0.74, 0.82, 0.76) });

  line(issuer.name, 13, true);
  line("Codice fiscale: " + issuer.tax_code, 10);
  line(issuer.address, 10, false, 15);
  line("Ricevuta n. " + receiptNumber, 9);
  line("Data emissione: " + issuedOn, 10, false, 19);
  line("RICEVUTO DA", 10, true);
  line(fee.full_name, 13, true);
  if (fee.fiscal_code) line("Codice fiscale del socio: " + fee.fiscal_code, 10);
  y -= 13;
  line("Importo ricevuto: " + euros, 14, true);
  line("Per quota associativa anno " + fee.fee_year, 11, true);
  line("Data del pagamento: " + date(fee.paid_on), 11);
  line("Modalità: " + (fee.payment_account === "cash" ? "Contanti" : "Versamento su conto bancario"), 11, false, 20);
  line("Il versamento è registrato nella contabilità dell'associazione.", 10);
  line("La quota associativa non è un'erogazione liberale e non dà", 9);
  line("diritto alle agevolazioni fiscali previste per le donazioni.", 9);
  line("La presente ricevuta non costituisce fattura.", 9);

  page.drawLine({ start: { x: 51, y: 84 }, end: { x: 544, y: 84 }, thickness: 0.8, color: rgb(0.74, 0.82, 0.76) });
  page.drawText("Insieme Oltre ODV - Ricevuta rilasciata al socio", { x: 51, y: 66, size: 9, font: normal, color: muted });
  pdf.setTitle("Ricevuta quota associativa " + fee.fee_year + " - " + fee.full_name);
  pdf.setSubject("Ricevuta del versamento della quota associativa");
  return Buffer.from(await pdf.save());
}
