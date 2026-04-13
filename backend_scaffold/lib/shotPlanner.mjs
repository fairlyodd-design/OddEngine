export function buildShotPlan({ episodeId, prompt, scenes = [], stylePreset = "cinematic-stills", aspectRatio = "16:9" }) {
  const normalizedScenes = scenes.length ? scenes : [
    {
      sceneId: "scene_01",
      title: "Cold Open",
      summary: prompt,
    }
  ];

  return {
    episodeId,
    stylePreset,
    aspectRatio,
    scenes: normalizedScenes.map((scene, index) => ({
      sceneId: scene.sceneId || `scene_${String(index + 1).padStart(2, "0")}`,
      title: scene.title || `Scene ${index + 1}`,
      summary: scene.summary || prompt,
      shots: [
        {
          shotId: `${scene.sceneId || `scene_${String(index + 1).padStart(2, "0")}`}_shot_01`,
          type: "establishing",
          durationSec: 3.5,
          camera: "wide slow push in",
          visualPrompt: `${scene.summary || prompt}, cinematic still, moody lighting, production design, no text`,
          negativePrompt: "text overlay, watermark, duplicate objects, malformed hands, blurry face, UI panels",
          continuity: {
            location: "primary setting",
            palette: "controlled cinematic palette",
            tone: "dramatic",
          },
        },
        {
          shotId: `${scene.sceneId || `scene_${String(index + 1).padStart(2, "0")}`}_shot_02`,
          type: "medium",
          durationSec: 2.5,
          camera: "medium held frame",
          visualPrompt: `${scene.summary || prompt}, medium character moment, cinematic still, no text`,
          negativePrompt: "text overlay, watermark, duplicate objects, malformed hands, blurry face, UI panels",
          continuity: {
            location: "primary setting",
            palette: "controlled cinematic palette",
            tone: "dramatic",
          },
        }
      ],
    })),
  };
}
