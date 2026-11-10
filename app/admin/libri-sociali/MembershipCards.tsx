"use client";

import { useMemo, useState } from "react";
import { membershipCardCode, canIssueMembershipCard, todayInRome } from "../../../lib/membershipCard";
import { uppercasePersonName } from "../../../lib/personName";

type Person = {
  id: string;
  full_name?: string;
  admitted_on?: string;
  ended_on?: string | null;
};

type Props = { people: Person[] };
const SITE = "https://insiemeoltreischia.it";

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossibile caricare un elemento grafico della tessera."));
    image.src = source;
  });
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}

function drawCentered(ctx: CanvasRenderingContext2D, value: string, y: number, font: string, color: string) {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.fillText(value, 360, y);
}

function fitLines(ctx: CanvasRenderingContext2D, value: string, maxWidth: number) {
  const words = value.trim().split(/\s+/);
  const result: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && ctx.measureText(current + " " + word).width > maxWidth) {
      result.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) result.push(current);
  return result;
}

async function renderCard(person: Required<Pick<Person, "id" | "full_name" | "admitted_on">>, year: number): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1160;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Il browser non supporta la generazione dell'immagine.");

  // Un solo modello ufficiale per tutti: cambiano esclusivamente dati personali e anno.
  ctx.fillStyle = "#fffefa";
  ctx.fillRect(0, 0, 720, 1160);
  ctx.fillStyle = "#e7f6f8";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(720, 0);
  ctx.lineTo(720, 90);
  ctx.bezierCurveTo(510, 180, 210, 55, 0, 170);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f9b746";
  ctx.beginPath();
  ctx.arc(714, 6, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d9eee3";
  ctx.beginPath();
  ctx.arc(-25, 95, 100, 0, Math.PI * 2);
  ctx.fill();

  const logo = await loadImage("/insieme-oltre-logo.png");
  const logoRatio = Math.min(440 / logo.width, 220 / logo.height);
  const logoW = logo.width * logoRatio;
  const logoH = logo.height * logoRatio;
  ctx.drawImage(logo, (720 - logoW) / 2, 90 + (220 - logoH) / 2, logoW, logoH);

  rect(ctx, 68, 324, 584, 66, 33, "#f08b2b");
  drawCentered(ctx, "TESSERA ASSOCIATIVA", 368, "bold 30px Arial, sans-serif", "#ffffff");

  ctx.textAlign = "left";
  ctx.fillStyle = "#54707a";
  ctx.font = "bold 19px Arial, sans-serif";
  ctx.fillText("NOME E COGNOME", 76, 441);
  ctx.fillStyle = "#173b53";
  ctx.font = "bold 41px Arial, sans-serif";
  let lines = fitLines(ctx, uppercasePersonName(person.full_name), 575);
  if (lines.length > 2) {
    ctx.font = "bold 31px Arial, sans-serif";
    lines = fitLines(ctx, uppercasePersonName(person.full_name), 620);
  }
  if (lines.length > 3) throw new Error("Nominativo troppo lungo per il modello della tessera.");
  lines.forEach((line, index) => ctx.fillText(line, 76, 486 + index * 40));

  ctx.strokeStyle = "#dce7e6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(76, 616);
  ctx.lineTo(644, 616);
  ctx.stroke();

  ctx.fillStyle = "#54707a";
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.fillText("CODICE TESSERA", 76, 658);
  ctx.fillText("DATA DI AMMISSIONE", 380, 658);
  ctx.fillStyle = "#173b53";
  ctx.font = "bold 26px Arial, sans-serif";
  ctx.fillText(membershipCardCode(person.id), 76, 700);
  ctx.fillText(person.admitted_on.split("-").reverse().join("/"), 380, 700);

  rect(ctx, 76, 728, 568, 52, 26, "#eaf4ed");
  drawCentered(ctx, "ANNO ASSOCIATIVO " + year, 763, "bold 23px Arial, sans-serif", "#225b45");

  const url = SITE + "/verifica-tessera?codice=" + encodeURIComponent(person.id) + "&anno=" + year;
  const qr = await import("qrcode");
  const qrImage = await loadImage(await qr.toDataURL(url, {
    width: 236,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#153b54", light: "#ffffff" }
  }));
  rect(ctx, 230, 800, 260, 260, 22, "#ffffff");
  ctx.drawImage(qrImage, 242, 812, 236, 236);

  // Elementi grafici decorativi, non sostitutivi del logo originale.
  ctx.fillStyle = "#009fc4";
  ctx.beginPath();
  ctx.moveTo(0, 1038);
  ctx.bezierCurveTo(180, 1002, 330, 1070, 520, 1038);
  ctx.bezierCurveTo(630, 1020, 680, 1022, 720, 1034);
  ctx.lineTo(720, 1160);
  ctx.lineTo(0, 1160);
  ctx.fill();
  ctx.fillStyle = "#3a986b";
  ctx.beginPath();
  ctx.moveTo(0, 1087);
  ctx.bezierCurveTo(255, 1055, 505, 1137, 720, 1064);
  ctx.lineTo(720, 1160);
  ctx.lineTo(0, 1160);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.fillText("insiemeoltreischia.it", 360, 1128);

  return canvas.toDataURL("image/png");
}

export default function MembershipCards({ people }: Props) {
  const current = Number(todayInRome().slice(0, 4));
  const [year, setYear] = useState(current);
  const [selected, setSelected] = useState("");
  const [image, setImage] = useState("");
  const [downloadName, setDownloadName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const currentToday = todayInRome();
  const eligible = useMemo(
    () => people.filter(p => p.full_name && p.admitted_on && canIssueMembershipCard(p, year, currentToday)),
    [people, year, currentToday]
  );

  function download() {
    if (!image) return;
    const anchor = document.createElement("a");
    anchor.href = image;
    anchor.download = downloadName;
    anchor.click();
  }

  async function generate() {
    const person = eligible.find(p => p.id === selected);
    if (!person || !person.full_name || !person.admitted_on) {
      setMessage("Seleziona un socio ammesso e non cessato nell'anno scelto.");
      return;
    }
    setBusy(true);
    setMessage("");
    setImage("");
    try {
      const png = await renderCard({ id: person.id, full_name: person.full_name, admitted_on: person.admitted_on }, year);
      setImage(png);
      setDownloadName("tessera-insieme-oltre-" + membershipCardCode(person.id) + "-" + year + ".png");
      setMessage("Tessera generata. Scarica il PNG per conservarlo o inviarlo al socio.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Generazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="soci-card" aria-label="Tessere associative digitali">
    <h2>Tessere associative digitali</h2>
    <p>Un unico modello per tutti i soci, con il logo originale dell'associazione. Scarica un'immagine PNG pronta per lo smartphone o WhatsApp. Nessuna foto richiesta.</p>
    <div className="soci-filters">
      <label>Anno associativo
        <select value={year} onChange={event => { setYear(Number(event.target.value)); setSelected(""); setImage(""); setMessage(""); }}>
          {[current, current + 1].map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>Seleziona socio
        <select value={selected} onChange={event => { setSelected(event.target.value); setImage(""); setMessage(""); }}>
          <option value="">Seleziona dal Libro soci</option>
          {eligible.map(person => <option key={person.id} value={person.id}>{uppercasePersonName(person.full_name)}</option>)}
        </select>
      </label>
    </div>
    <p><small>Il QR verifica in tempo reale l'iscrizione nel Libro soci e l'anno indicato, senza pubblicare dati personali. La tessera non certifica il pagamento della quota annuale. I codici sono stabili e non progressivi.</small></p>
    <button className="primary" disabled={busy || !selected} type="button" onClick={() => void generate()}>
      {busy ? "Generazione in corso…" : "Genera tessera"}
    </button>
    {message && <p className="soci-message" role="status">{message}</p>}
    {image && <div style={{ marginTop: 20 }}>
      {/* Una preview verticale in scala, mentre il PNG originale resta a 720×1160. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="Anteprima della tessera associativa digitale" style={{ display: "block", width: "100%", maxWidth: 340, height: "auto", borderRadius: 18, boxShadow: "0 8px 24px #152e3429" }} />
      <p><button type="button" onClick={download}>Scarica tessera PNG</button></p>
    </div>}
  </section>;
}
