import type { ArtifactClassification } from "../artifactClassifier";

export function buildAudioTrackPlan(prompt: string, classification: ArtifactClassification) {
  const count = Math.max(4, classification.chaptersOrScenes);
  return Array.from({ length: count }, (_, idx) => ({
    number: idx + 1,
    title: classification.kind === "album" ? `Track ${idx + 1}` : `Part ${idx + 1}`,
    beat: idx === 0
      ? "Catch attention with the strongest hook."
      : idx === count - 1
        ? "Deliver the memorable finish and replay value."
        : "Build variation without losing the core motif.",
  }));
}

export function buildAudioDeliverables(prompt: string, classification: ArtifactClassification) {
  return [
    `${classification.runtimeHint} structure map`,
    "lyrics / hook packet",
    "generation + mix checklist",
    "cover / metadata brief",
    "release-ready asset pack",
  ];
}
