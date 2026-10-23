import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { receiptTitle, paymentLabel, type Receipt } from "./receipts";

export async function receiptPdf(receipt: Receipt, preview = false) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const asset = (name: string) =>
    readFile(path.join(process.cwd(), "lib/receipt-assets", name));
  const [regularBytes, boldBytes, logoBytes] = await Promise.all([
    asset("DejaVuSans.ttf"),
    asset("DejaVuSans-Bold.ttf"),
    asset("logo.png"),
  ]);
  const regular = await pdf.embedFont(regularBytes, { subset: true });
  const bold = await pdf.embedFont(boldBytes, { subset: true });
  const logo = await pdf.embedPng(logoBytes);
  const supported = new Set(regular.getCharacterSet());
  let page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  const safe = (value: string) =>
    Array.from(value)
      .map((c) => {
        try {
          if (!supported.has(c.codePointAt(0)!))
            throw new Error("unsupported character");
          return c;
        } catch {
          throw new Error(
            "Un campo contiene caratteri non supportati dal PDF. Verifica l’anteprima e usa una traslitterazione concordata con il versante.",
          );
        }
      })
      .join("");
  const line = (value: string, size = 11, strong = false) => {
    const font = strong ? bold : regular;
    // Wrap also uninterrupted strings: no clipping for long names/references.
    let text = safe(value),
      row = "";
    const rows: string[] = [];
    for (const char of text) {
      if (font.widthOfTextAtSize(row + char, size) > 487) {
        const split = row.lastIndexOf(" ");
        if (split > 0) {
          rows.push(row.slice(0, split));
          row = row.slice(split + 1) + char;
        } else {
          rows.push(row);
          row = char;
        }
      } else row += char;
    }
    rows.push(row);
    for (text of rows) {
      if (y < 65) {
        page = pdf.addPage([595.28, 841.89]);
        y = 785;
      }
      page.drawText(text, {
        x: 54,
        y,
        size,
        font,
        color: rgb(0.14, 0.23, 0.18),
      });
      y -= size * 1.5;
    }
  };
  const dims = logo.scale(Math.min(135 / logo.width, 80 / logo.height));
  page.drawImage(logo, { x: 54, y: y - dims.height, ...dims });
  y -= dims.height + 30;
  line(receipt.issuer.name, 16, true);
  line(`Codice fiscale: ${receipt.issuer.tax_code}`);
  line(receipt.issuer.address);
  y -= 20;
  line(
    preview
      ? "ANTEPRIMA - DOCUMENTO NON EMESSO"
      : receipt.cancelled
        ? "RICEVUTA ANNULLATA"
        : receiptTitle(receipt.data.type),
    15,
    true,
  );
  line(
    `Numero: ${preview ? "da assegnare" : `${receipt.number}/${receipt.issued_on.slice(0, 4)}`} - Data: ${receipt.issued_on.split("-").reverse().join("/")}`,
  );
  y -= 20;
  line("RICEVUTO DA", 10, true);
  line(receipt.data.name, 13, true);
  line(`Codice fiscale / P. IVA: ${receipt.data.tax_code}`);
  line(receipt.data.address);
  y -= 16;
  line(
    `Importo ricevuto: ${(receipt.amount_cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}`,
    15,
    true,
  );
  line(`Data incasso: ${receipt.payment_date.split("-").reverse().join("/")}`);
  line(`Pagamento: ${paymentLabel(receipt.data.payment)}`);
  if (receipt.data.reference) line(`Riferimento: ${receipt.data.reference}`);
  y -= 16;
  line(receipt.data.description);
  y -= 16;
  line(
    receipt.data.type === "donation"
      ? "Versamento liberale senza corrispettivo né consegna di beni o servizi."
      : "Partecipazione alla raccolta fondi con consegna dei beni descritti.",
  );
  line("Il documento attesta l’incasso e non costituisce fattura.");
  line(
    "Non attesta automaticamente il diritto a detrazioni o deduzioni fiscali.",
  );
  y -= 18;
  line(`Per l’associazione: ${receipt.issuer.representative}`);
  line(
    "Documento generato elettronicamente; non contiene una firma digitale.",
    9,
  );
  if (receipt.cancelled)
    line(`Motivo annullamento: ${receipt.cancellation_reason ?? ""}`);
  pdf.setTitle(
    preview
      ? "Anteprima ricevuta"
      : `Ricevuta ${receipt.number}/${receipt.issued_on.slice(0, 4)}`,
  );
  return Buffer.from(await pdf.save());
}
