export type ArtifactMode = "book" | "video" | "audio" | "script" | "multi";
export type ArtifactKind = "novel" | "short-story" | "cartoon" | "movie" | "series" | "song" | "album" | "script" | "course" | "guide" | "unknown";

export type ArtifactClassification = {
  mode: ArtifactMode;
  kind: ArtifactKind;
  label: string;
  titleHint: string;
  audienceHint: string;
  runtimeHint: string;
  polishLevel: "fast" | "standard" | "premium";
  chaptersOrScenes: number;
  confidence: number;
  signals: string[];
};

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function toTitleHint(prompt: string) {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Untitled artifact";
  return cleaned.slice(0, 72);
}

export function classifyArtifactPrompt(prompt: string): ArtifactClassification {
  const text = String(prompt || "").toLowerCase();
  const signals: string[] = [];

  let mode: ArtifactMode = "multi";
  let kind: ArtifactKind = "unknown";
  let runtimeHint = "Flexible";
  let chaptersOrScenes = 12;
  let polishLevel: ArtifactClassification["polishLevel"] = "standard";

  if (hasAny(text, ["300 page", "300-page", "novel", "book", "manuscript"])) {
    mode = "book";
    kind = hasAny(text, ["novella", "short novel"]) ? "short-story" : "novel";
    runtimeHint = kind === "novel" ? "250–320 pages" : "80–160 pages";
    chaptersOrScenes = kind === "novel" ? 42 : 18;
    polishLevel = "premium";
    signals.push("longform-book");
  }

  if (hasAny(text, ["cartoon", "animation", "animated"])) {
    mode = "video";
    kind = hasAny(text, ["series", "episode"]) ? "series" : "cartoon";
    runtimeHint = kind === "series" ? "Pilot + episode pack" : "2–6 minute short";
    chaptersOrScenes = kind === "series" ? 12 : 10;
    polishLevel = "premium";
    signals.push("animated-video");
  }

  if (hasAny(text, ["movie", "film", "trailer", "cinematic"])) {
    mode = "video";
    kind = "movie";
    runtimeHint = hasAny(text, ["short", "short film"]) ? "4–12 minute short film" : "Feature-ready development pack";
    chaptersOrScenes = hasAny(text, ["short", "short film"]) ? 14 : 36;
    polishLevel = "premium";
    signals.push("film-production");
  }

  if (hasAny(text, ["song", "album", "ep", "music video", "track"])) {
    mode = hasAny(text, ["music video"]) ? "multi" : "audio";
    kind = hasAny(text, ["album", "ep"]) ? "album" : "song";
    runtimeHint = kind === "album" ? "3–7 tracks" : "Single release";
    chaptersOrScenes = kind === "album" ? 6 : 4;
    polishLevel = kind === "album" ? "premium" : "standard";
    signals.push("audio-release");
  }

  if (hasAny(text, ["script", "screenplay", "pilot", "dialogue draft"])) {
    mode = "script";
    kind = hasAny(text, ["pilot"]) ? "series" : "script";
    runtimeHint = kind === "series" ? "Pilot script" : "Script draft";
    chaptersOrScenes = kind === "series" ? 18 : 14;
    signals.push("script-first");
  }

  if (hasAny(text, ["course", "bundle", "offer", "kit", "funnel"])) {
    mode = "multi";
    kind = hasAny(text, ["course"]) ? "course" : "guide";
    runtimeHint = kind === "course" ? "Module pack" : "Offer bundle";
    chaptersOrScenes = kind === "course" ? 9 : 7;
    polishLevel = "premium";
    signals.push("bundle");
  }

  if (hasAny(text, ["fast", "quick", "today", "asap"])) {
    polishLevel = "fast";
    signals.push("fast-turn");
  }

  const audienceHint = hasAny(text, ["kids", "children", "family"])
    ? "Family / younger audience"
    : hasAny(text, ["adult", "dark", "gritty", "mature"])
      ? "Mature audience"
      : "Broad audience";

  return {
    mode,
    kind,
    label: `${mode.toUpperCase()} • ${kind}`,
    titleHint: toTitleHint(prompt),
    audienceHint,
    runtimeHint,
    polishLevel,
    chaptersOrScenes,
    confidence: Math.min(0.98, 0.42 + signals.length * 0.12),
    signals,
  };
}
