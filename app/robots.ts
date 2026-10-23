import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Consenti ai motori di leggere noindex in /admin e /area-soci.
      // Le autorizzazioni restano obbligatorie: robots.txt non protegge dati privati.
      disallow: [
        "/api/admin",
        "/api/associazione",
        "/api/accesso",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
