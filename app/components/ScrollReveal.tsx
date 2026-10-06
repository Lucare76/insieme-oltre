"use client";

import { useEffect } from "react";

/**
 * Animazioni d'ingresso della homepage: un solo IntersectionObserver per tutti gli elementi con `data-reveal`.
 *
 * Uso nel markup:
 *   data-reveal="fade-up" | "fade-left" | "fade-right" | "scale" | "fade" | "title" | "impact" | "accent"
 *   data-reveal-stagger            sul genitore: i figli diretti con data-reveal entrano in sequenza
 *   style={{ "--reveal-delay": "200ms" }}  ritardo aggiuntivo del singolo elemento
 *
 * Gli elementi vengono nascosti solo quando <html> ha la classe `reveal-ready` (messa da REVEAL_BOOT_SCRIPT):
 * senza JavaScript, o con prefers-reduced-motion, tutto resta visibile. Ogni elemento si anima una sola volta,
 * poi perde l'attributo e torna ai suoi stili normali.
 */

const READY = "reveal-ready";
const LIVE = "reveal-live";

/** Eseguito prima che la pagina sia disegnata. Se il componente non parte entro 4 s, toglie il nascondimento. */
export const REVEAL_BOOT_SCRIPT = `(function(){var d=document.documentElement;
if(!("IntersectionObserver" in window)||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
d.classList.add("${READY}");
setTimeout(function(){if(!d.classList.contains("${LIVE}"))d.classList.remove("${READY}")},4000);})();`;

/** Durata massima delle transizioni in home-motion.css. */
const DURATION_MS = 1100;

export function ScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!("IntersectionObserver" in window) || reduced) {
      root.classList.remove(READY);
      return;
    }
    // Il boot script non ha nascosto nulla, oppure il suo fallback ha già mostrato tutto: non nascondere di nuovo.
    if (!root.classList.contains(READY)) return;
    root.classList.add(LIVE);

    const mobile = window.matchMedia("(max-width: 760px)").matches;
    const step = mobile ? 70 : 120;
    const delayScale = mobile ? 0.7 : 1;

    // Ritardo complessivo di ogni elemento: il suo --reveal-delay più la posizione nella sequenza del genitore.
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const order = new Map<HTMLElement, number>();
    document.querySelectorAll<HTMLElement>("[data-reveal-stagger]").forEach((parent) => {
      parent.querySelectorAll<HTMLElement>(":scope > [data-reveal]").forEach((child, index) => order.set(child, index));
    });
    for (const el of elements) {
      const own = parseFloat(el.style.getPropertyValue("--reveal-delay")) || 0;
      el.style.setProperty("--reveal-wait", `${Math.round(own * delayScale + (order.get(el) ?? 0) * step)}ms`);
    }

    const timers = new Set<number>();
    const finish = (el: HTMLElement) => {
      el.removeAttribute("data-reveal");
      el.classList.remove("is-revealed");
      el.style.removeProperty("--reveal-wait");
    };
    const reveal = (el: HTMLElement, instant: boolean) => {
      if (!el.hasAttribute("data-reveal") || el.classList.contains("is-revealed")) return;
      observer.unobserve(el);
      if (instant) {
        finish(el);
        return;
      }
      el.classList.add("is-revealed");
      const wait = parseFloat(el.style.getPropertyValue("--reveal-wait")) || 0;
      const timer = window.setTimeout(() => { timers.delete(timer); finish(el); }, wait + DURATION_MS + 150);
      timers.add(timer);
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (entry.isIntersecting) reveal(el, false);
        // Già superato (salto con un'ancora, scroll veloce): compare subito, senza animazione.
        else if (entry.boundingClientRect.bottom < 0) reveal(el, true);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

    // Una sezione raggiunta con un'ancora (#storie, #unisciti...) è leggibile subito, senza aspettare l'observer.
    const revealSection = (hash: string) => {
      const id = decodeURIComponent(hash.replace(/^#/, ""));
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      if (target.hasAttribute("data-reveal")) reveal(target, true);
      target.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => reveal(el, true));
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href^="#"]');
      if (link) revealSection(link.getAttribute("href") ?? "");
    };
    const onHashChange = () => revealSection(window.location.hash);
    // Dopo un refresh a metà pagina il browser ripristina lo scroll un attimo dopo: ciò che sta sopra compare subito.
    const revealPassed = () => {
      for (const el of elements) if (el.hasAttribute("data-reveal") && el.getBoundingClientRect().bottom < 0) reveal(el, true);
    };

    for (const el of elements) observer.observe(el);
    revealSection(window.location.hash);
    document.addEventListener("click", onClick, true);
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("load", revealPassed);
    const late = window.setTimeout(revealPassed, 400);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("load", revealPassed);
      window.clearTimeout(late);
      timers.forEach((timer) => window.clearTimeout(timer));
      // Chi era già in fase di comparsa viene completato (i suoi timer sono stati annullati).
      document.querySelectorAll<HTMLElement>("[data-reveal].is-revealed").forEach(finish);
    };
  }, []);

  return null;
}
