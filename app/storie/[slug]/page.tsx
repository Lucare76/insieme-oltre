import type { Metadata } from "next";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { StoryPageLayout } from "../components/StoryPageLayout";
import { notFound } from "next/navigation";
import { PHOTO_PATTERN, hasDedicatedPage, isPublished, storyParagraphs } from "../../../lib/children";
import { getHomeContent } from "../../../lib/siteContent";
import { socialMetadata, storySocialImage } from "../../../lib/seo";

type Props = { params: Promise<{ slug: string }> };

async function findStory(slug: string) {
  const { children } = await getHomeContent();
  const child = children.find((item) => item.slug === slug);
  // Le storie con una pagina dedicata hanno la loro route statica (es. app/storie/aurora).
  return child && isPublished(child) && !hasDedicatedPage(child) ? child : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const child = await findStory((await params).slug);
  if (!child) return {};

  const path = `/storie/${child.slug}`;
  const description = child.storyTitle || child.cardSubtitle;
  return {
    title: `${child.name} | Insieme Oltre`,
    description,
    alternates: { canonical: path },
    ...socialMetadata({
      title: `La storia di ${child.name} | Insieme Oltre`,
      description,
      path,
      type: "article",
      image: storySocialImage(child.photos, child.name),
    }),
  };
}

export default async function ChildStoryPage({ params }: Props) {
  const child = await findStory((await params).slug);
  if (!child) notFound();

  const photos = child.photos.filter((photo) => PHOTO_PATTERN.test(photo) && (photo.startsWith("/api/storie/foto/") || existsSync(join(process.cwd(), "public", photo.slice(1)))));
  const paragraphs = storyParagraphs(child.storyText);

  return (
    <StoryPageLayout
      name={child.name}
      subtitle={child.storyTitle}
      paragraphs={paragraphs}
      photos={photos}
    />
  );
}
