import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/admin",
        "/api/associazione",
        "/api/accesso",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
