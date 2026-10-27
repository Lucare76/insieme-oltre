"use client";

import { lazy, Suspense, useEffect, useState } from "react";

const DesktopScrollReveal = lazy(() => import("./DesktopScrollReveal"));

const READY = "reveal-ready";
const LIVE = "reveal-live";

/** Eseguito prima che la pagina sia disegnata. Se il componente non parte entro 4 s, toglie il nascondimento. */
export const REVEAL_BOOT_SCRIPT = `(function(){var d=document.documentElement;
if(!("IntersectionObserver" in window)||matchMedia("(prefers-reduced-motion: reduce)").matches||matchMedia("(max-width: 760px)").matches)return;
d.classList.add("${READY}");
setTimeout(function(){if(!d.classList.contains("${LIVE}"))d.classList.remove("${READY}")},4000);})();`;

/** Download the animation controller only where the boot script enabled it. */
export function ScrollReveal() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!document.documentElement.classList.contains(READY)) return;
    const frame = requestAnimationFrame(() => setEnabled(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return enabled ? <Suspense fallback={null}><DesktopScrollReveal /></Suspense> : null;
}
