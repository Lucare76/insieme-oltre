"use client";

import { useState } from "react";

const IBAN = "IT76N0200839932000107493053";

export function CopyIbanButton() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(IBAN);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className="support-copy" type="button" onClick={copy} aria-live="polite">
      {copied ? "IBAN copiato ✓" : "Copia IBAN"}
    </button>
  );
}
