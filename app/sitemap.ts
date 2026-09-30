import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/siteUrl";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/storie/aurora`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/storie/emanuele`, changeFrequency: "monthly", priority: 0.7 },
  ];
}
