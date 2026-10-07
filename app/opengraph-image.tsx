import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SLOGAN, defaultSocialImage } from "../lib/seo";

// Anteprima social del sito (Open Graph e Twitter), generata in fase di build: niente immagini esterne.
export const alt = defaultSocialImage.alt;
export const size = { width: defaultSocialImage.width, height: defaultSocialImage.height };
export const contentType = "image/png";

const colors = { ink: "#24312a", cream: "#f8f3ea", coral: "#e6685e", sage: "#425a48", gold: "#e0a757" };

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public", "insieme-oltre-logo-top.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          position: "relative",
          background: colors.cream,
          color: colors.ink,
          padding: "0 72px",
        }}
      >
        {/* Le "orbite" che circondano il logo nella hero della homepage. */}
        <div style={{ position: "absolute", left: -60, top: -40, width: 700, height: 700, borderRadius: 9999, border: `2px solid ${colors.coral}`, opacity: 0.18 }} />
        <div style={{ position: "absolute", left: 10, top: 30, width: 560, height: 560, borderRadius: 9999, background: "#ffffff", opacity: 0.6 }} />

        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse accetta solo <img>. */}
        <img src={logoSrc} width={520} height={390} alt="" style={{ position: "relative", objectFit: "contain" }} />

        <div style={{ display: "flex", flexDirection: "column", marginLeft: 48, flex: 1 }}>
          <div style={{ fontSize: 21, letterSpacing: 3, textTransform: "uppercase", color: colors.coral }}>
            Ischia · Famiglie e inclusione
          </div>
          <div style={{ marginTop: 22, fontSize: 64, lineHeight: 1.08, letterSpacing: -1.5 }}>{SLOGAN}</div>
          <div style={{ marginTop: 30, width: 120, height: 6, borderRadius: 6, background: colors.gold }} />
          <div style={{ marginTop: 26, fontSize: 26, color: colors.sage }}>insiemeoltreischia.it</div>
        </div>
      </div>
    ),
    size,
  );
}
