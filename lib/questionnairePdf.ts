import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  anonymousLabel,
  answerText,
  qsDateTime,
  type QsQuestion,
  type QsSubmission,
} from "./questionnaires";

const WIDTH = 595.28,
  HEIGHT = 841.89,
  MARGIN = 54,
  TEXT_WIDTH = WIDTH - MARGIN * 2;

/** Una compilazione per pagina (o più pagine se le risposte sono lunghe). Nessun testo troncato. */
export async function submissionsPdf(input: {
  title: string;
  sessionLabel: string;
  questions: QsQuestion[];
  submissions: QsSubmission[];
}) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const asset = (name: string) =>
    readFile(path.join(process.cwd(), "lib/receipt-assets", name));
  const regular = await pdf.embedFont(await asset("DejaVuSans.ttf"), { subset: true });
  const bold = await pdf.embedFont(await asset("DejaVuSans-Bold.ttf"), { subset: true });
  const supported = new Set(regular.getCharacterSet());
  let replaced = false;
  // Le emoji non esistono nel font: segnaposto visibile e avviso, il testo originale resta nel CSV.
  const safe = (value: string) =>
    Array.from(value.replace(/\r\n?/g, "\n").replace(/\t/g, "    "))
      .map((c) => {
        if (c === "\n" || supported.has(c.codePointAt(0)!)) return c;
        replaced = true;
        return "□";
      })
      .join("");
  let page: PDFPage = pdf.addPage([WIDTH, HEIGHT]);
  let y = HEIGHT - MARGIN;
  const newPage = () => {
    page = pdf.addPage([WIDTH, HEIGHT]);
    y = HEIGHT - MARGIN;
  };
  const write = (value: string, size = 11, font: PDFFont = regular, color = rgb(0.13, 0.2, 0.16)) => {
    const lead = size * 1.45;
    // Larghezze per carattere in cache: lineare anche con risposte molto lunghe.
    const widths = new Map<string, number>();
    const width = (text: string) => {
      let total = 0;
      for (const c of text) {
        let w = widths.get(c);
        if (w === undefined) widths.set(c, (w = font.widthOfTextAtSize(c, size)));
        total += w;
      }
      return total;
    };
    for (const paragraph of safe(value).split("\n")) {
      const rows: string[] = [];
      let row = "",
        rowWidth = 0;
      for (const char of paragraph) {
        const w = width(char);
        if (rowWidth + w <= TEXT_WIDTH) {
          row += char;
          rowWidth += w;
          continue;
        }
        const split = row.lastIndexOf(" ");
        if (split > 0) {
          rows.push(row.slice(0, split));
          row = row.slice(split + 1) + char;
        } else {
          rows.push(row);
          row = char;
        }
        rowWidth = width(row);
      }
      rows.push(row);
      for (const text of rows) {
        if (y - lead < MARGIN) newPage();
        y -= lead;
        page.drawText(text, { x: MARGIN, y, size, font, color });
      }
    }
  };
  const gap = (n: number) => {
    y -= n;
  };
  input.submissions.forEach((submission, index) => {
    if (index > 0) newPage();
    write(input.title, 9, regular, rgb(0.35, 0.4, 0.36));
    write(input.sessionLabel, 9, regular, rgb(0.35, 0.4, 0.36));
    gap(8);
    write(anonymousLabel(submission.seq), 17, bold);
    write("Inviata il " + qsDateTime(submission.submitted_at), 9, regular, rgb(0.35, 0.4, 0.36));
    gap(10);
    input.questions.forEach((question, n) => {
      gap(8);
      write(`${n + 1}. ${question.prompt}`, 11, bold);
      const answer = answerText(
        question,
        submission.qs_answers.find((a) => a.question_id === question.id),
      );
      write(answer || "— Nessuna risposta", 11);
    });
  });
  if (!input.submissions.length) write("Nessuna compilazione ricevuta.", 12);
  if (replaced) {
    newPage();
    write(
      "Nota: alcuni simboli (per esempio emoji) non sono rappresentabili nel PDF e sono indicati con □. Il testo originale completo è visibile a schermo e nell’esportazione CSV.",
      10,
    );
  }
  return pdf.save();
}
