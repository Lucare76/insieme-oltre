"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";

const ContactForm = lazy(() =>
  import("./ContactForm").then((module) => ({ default: module.ContactForm })),
);

type Props = {
  available: boolean;
  privacyHref: string;
};

function ContactPlaceholder() {
  return (
    <div className="contact-form contact-form-placeholder" aria-hidden="true">
      <div className="contact-placeholder-line" />
      <div className="contact-placeholder-grid">
        <span /><span /><span /><span />
        <span className="contact-placeholder-wide" />
      </div>
      <div className="contact-placeholder-button" />
    </div>
  );
}

/**
 * Il form è quasi in fondo alla homepage: evita di idratarlo nel caricamento iniziale.
 * Il chunk parte in anticipo quando la sezione si avvicina alla viewport.
 */
export function LazyContactForm(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || load) return;

    if (!("IntersectionObserver" in window)) {
      setLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setLoad(true);
        observer.disconnect();
      },
      { rootMargin: "1000px 0px", threshold: 0.01 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [load]);

  return (
    <div ref={ref}>
      {load ? (
        <Suspense fallback={<ContactPlaceholder />}>
          <ContactForm {...props} />
        </Suspense>
      ) : (
        <ContactPlaceholder />
      )}
    </div>
  );
}
