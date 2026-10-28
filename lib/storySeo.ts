import type { ChildStory } from "./children";

/** Describe the existing story, without adding a diagnosis or rewriting its content. */
export function storySeoCopy(child: Pick<ChildStory, "name" | "storyTitle" | "cardSubtitle">) {
  const clean = (text: string) => text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  const name = clean(child.name);
  const subject = clean(child.storyTitle) || clean(child.cardSubtitle);
  const topic = subject.replace(/[.!?]+$/, "");
  return {
    title: topic ? `${name}: ${topic} | Insieme Oltre` : `La storia di ${name} | Insieme Oltre`,
    description: topic
      ? `${topic}. La storia di ${name}, raccontata da Insieme Oltre a Ischia.`
      : `Scopri la storia di ${name} e il progetto di Insieme Oltre, associazione di famiglie a Ischia.`,
  };
}
