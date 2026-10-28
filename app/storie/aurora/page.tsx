import type { Metadata } from "next";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PHOTO_PATTERN, storyParagraphs } from "../../../lib/children";
import { StoryPageLayout } from "../components/StoryPageLayout";
import { getHomeContent } from "../../../lib/siteContent";
import { socialMetadata, storySocialImage } from "../../../lib/seo";

export const metadata: Metadata = {
  title: "Aurora: la sua storia raccontata da mamma e papà | Insieme Oltre",
  description: "Aurora è Aurora. La sua storia raccontata da mamma e papà.",
  alternates: { canonical: "/storie/aurora" },
  ...socialMetadata({
    title: "La storia di Aurora | Insieme Oltre",
    description: "Aurora è Aurora. La sua storia raccontata da mamma e papà.",
    path: "/storie/aurora",
    type: "article",
    image: storySocialImage([], "Aurora"),
  }),
};

export default async function AuroraStoryPage() {
  const { auroraStory: story, children } = await getHomeContent();
  const aurora = children.find((child) => child.slug === "aurora");
  const photos = (aurora?.photos ?? []).filter((photo) => PHOTO_PATTERN.test(photo) && (photo.startsWith("/api/storie/foto/") || existsSync(join(process.cwd(), "public", photo.slice(1)))));
  const paragraphs = aurora?.storyText.trim() ? storyParagraphs(aurora.storyText) : story.paragraphs;

  return (
    <StoryPageLayout
      name="Aurora"
      subtitle={aurora?.storyTitle.trim() || story.subtitle}
      paragraphs={paragraphs}
      photos={photos}
      pause={{ lines: [story.pauseLine1, story.pauseLine2] }}
      parents={{
        title: story.parentsTitle,
        paragraphs: story.parentsParagraphs,
        emphasizedIndex: 2,
      }}
    />
  );
}
