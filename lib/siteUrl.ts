/** Dominio canonico: sovrascrivibile con NEXT_PUBLIC_SITE_URL (es. per un ambiente di prova). */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.insiemeoltreischia.it").replace(/\/$/, "");
