"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Result = { valid: boolean; message: string; year?: number; code?: string };

export default function Page() {
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codice = params.get("codice") || "";
    const anno = params.get("anno") || "";
    if (!codice || !anno) {
      setResult({ valid: false, message: "Codice tessera mancante." });
      return;
    }
    const controller = new AbortController();
    fetch("/api/verifica-tessera?codice=" + encodeURIComponent(codice) + "&anno=" + encodeURIComponent(anno), {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async response => (await response.json()) as Result)
      .then(data => setResult(data))
      .catch(() => { if (!controller.signal.aborted) setResult({ valid: false, message: "Verifica temporaneamente non disponibile." }); });
    return () => controller.abort();
  }, []);

  return <main style={{ minHeight: "100vh", background: "#f5f6f0", padding: "32px 16px", color: "#173b53", fontFamily: "Arial, sans-serif" }}>
    <section style={{ background: "#fff", maxWidth: 480, margin: "20px auto", padding: 28, borderRadius: 20, textAlign: "center", boxShadow: "0 4px 26px #1234" }}>
      <Image src="/insieme-oltre-logo.png" alt="Logo ufficiale Insieme Oltre" width={220} height={165} style={{ objectFit: "contain", maxWidth: "100%", height: "auto" }} />
      <h1>Verifica tessera associativa</h1>
      {!result ? <p role="status">Verifica in corso…</p> : <>
        <h2 style={{ color: result.valid ? "#1e724f" : "#9b3b2e" }}>{result.valid ? "Tessera valida" : "Tessera non valida"}</h2>
        <p role="status">{result.message}</p>
        {result.year && <p>Anno associativo: <strong>{result.year}</strong></p>}
        {result.code && <p>Codice: <strong>{result.code}</strong></p>}
      </>}
      <p><Link href="/">Torna al sito di Insieme Oltre</Link></p>
    </section>
  </main>;
}
