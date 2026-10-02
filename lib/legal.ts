export type LegalPage = {
  href: string;
  label: string;
  /** Finché è false la pagina non viene linkata da nessuna parte: niente link rotti. */
  published: boolean;
};

export const privacyPolicy: LegalPage = {
  href: "/privacy-policy",
  label: "Privacy Policy",
  // Da attivare solo quando la pagina esiste con i dati reali dell'associazione (titolare, sede, C.F., contatti).
  published: false,
};

export const cookiePolicy: LegalPage = {
  href: "/cookie-policy",
  label: "Cookie Policy",
  published: true,
};

export const legalPages = [privacyPolicy, cookiePolicy].filter((page) => page.published);
