export function buildContinuityManifest({ prompt, scenes = [], shotPlan }) {
  return {
    seedPrompt: prompt,
    characters: [],
    locations: scenes.map((s) => s.title || s.sceneId || "scene"),
    palette: "controlled cinematic palette",
    notes: "Persist recurring descriptors, wardrobe, palette, and time-of-day across shots.",
    sceneCount: shotPlan?.scenes?.length || 0,
  };
}
