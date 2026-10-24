import type { Metadata } from "next";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { StoryPageLayout } from "../components/StoryPageLayout";
import { getHomeContent } from "../../../lib/siteContent";
import { socialMetadata, storySocialImage } from "../../../lib/seo";

const photoNames = ["aurora-storia.jpg", "aurora-storia-2.jpg", "aurora-storia-3.jpg"];

export const metadata: Metadata = {
  title: "Aurora | Insieme Oltre",
  description: "Aurora è Aurora. La sua storia raccontata da mamma e papà.",
  alternates: { canonical: "/storie/aurora" },
  ...socialMetadata({
    title: "La storia di Aurora | Insieme Oltre",
    description: "Aurora è Aurora. La sua storia raccontata da mamma e papà.",
    path: "/storie/aurora",
    type: "article",
    image: storySocialImage(photoNames.map((name) => `/${name}`), "Aurora"),
  }),
};

export default async function AuroraStoryPage() {
  const photos = photoNames.filter((name) => existsSync(join(process.cwd(), "public", name)));
  const { auroraStory: story } = await getHomeContent();

  return (
    <StoryPageLayout
      name="Aurora"
      subtitle={story.subtitle}
      paragraphs={story.paragraphs}
      photos={photos.map((name) => `/${name}`)}
      pause={{ lines: [story.pauseLine1, story.pauseLine2] }}
      parents={{
        title: story.parentsTitle,
        paragraphs: story.parentsParagraphs,
        emphasizedIndex: 2,
      }}
    />
  );
}
