import type { ArtifactClassification } from "../artifactClassifier";

export function buildVideoScenePlan(prompt: string, classification: ArtifactClassification) {
  const count = Math.max(8, classification.chaptersOrScenes);
  return Array.from({ length: count }, (_, idx) => ({
    number: idx + 1,
    title: `Scene ${idx + 1}`,
    beat: idx === 0
      ? "Open with the strongest visual hook immediately."
      : idx === count - 1
        ? "Land the emotional payoff and final image."
        : idx % 3 === 0
          ? "Escalate visually and emotionally."
          : "Move the story forward with a clear beat and shot idea.",
  }));
}

export function buildVideoDeliverables(prompt: string, classification: ArtifactClassification) {
  return [
    `${classification.runtimeHint} production map`,
    "script + scene breakdown",
    "shot / storyboard queue",
    "voice line packet",
    "audience-ready release pack",
  ];
}
