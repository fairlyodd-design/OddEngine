import type { ArtifactClassification } from "../artifactClassifier";

export function buildBookOutline(prompt: string, classification: ArtifactClassification) {
  const count = Math.max(12, classification.chaptersOrScenes);
  const titleBase = classification.kind === "novel" ? "Chapter" : "Section";
  return Array.from({ length: count }, (_, idx) => ({
    number: idx + 1,
    title: `${titleBase} ${idx + 1}`,
    beat: idx === 0
      ? "Hook the reader and lock the promise."
      : idx === count - 1
        ? "Deliver the payoff, emotional landing, and sequel bait if wanted."
        : idx % 5 === 0
          ? "Escalate the conflict and reveal a deeper layer."
          : "Advance the character, tension, or mystery in a concrete way.",
  }));

}

export function buildBookDeliverables(prompt: string, classification: ArtifactClassification) {
  const pages = classification.kind === "novel" ? "~300 pages" : classification.runtimeHint;
  return [
    `${pages} manuscript plan`,
    "chapter-by-chapter writing queue",
    "revision pass checklist",
    "cover + blurb brief",
    "audience-ready export pack",
  ];
}
