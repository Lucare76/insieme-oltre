import type { MetadataRoute } from "next";
import { isPublished } from "../lib/children";
import { legalPages } from "../lib/legal";
import { getHomeContent } from "../lib/siteContent";
import { siteUrl } from "../lib/siteUrl";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { children } = await getHomeContent();
  const stories = children.filter(isPublished).map((child) => ({
    url: `${siteUrl}/storie/${child.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const legal = legalPages.map((page) => ({ url: `${siteUrl}${page.href}`, changeFrequency: "yearly" as const, priority: 0.2 }));

  return [{ url: siteUrl, changeFrequency: "monthly", priority: 1 }, ...stories, ...legal];
}
