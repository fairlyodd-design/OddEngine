import fs from "node:fs/promises";
import path from "node:path";
import { buildShotPlan } from "./lib/shotPlanner.mjs";
import { buildContinuityManifest } from "./lib/sceneContinuity.mjs";
import { createSceneProvider } from "./lib/sceneProviders/baseProvider.mjs";
import { buildShotClip } from "./lib/sceneClipBuilder.mjs";
import { assembleSceneClip } from "./lib/sceneAssembly.mjs";

export async function runSceneGenerationBridge({
  rootDir,
  episodeId,
  prompt,
  scenes = [],
  provider = "mock",
  stylePreset = "cinematic-stills",
  aspectRatio = "16:9",
}) {
  const episodeDir = path.join(rootDir, episodeId);
  const shotsDir = path.join(episodeDir, "shots");
  const shotClipsDir = path.join(episodeDir, "shot_clips");
  const sceneClipsDir = path.join(episodeDir, "scene_clips");
  const logsDir = path.join(episodeDir, "logs");

  await fs.mkdir(shotsDir, { recursive: true });
  await fs.mkdir(shotClipsDir, { recursive: true });
  await fs.mkdir(sceneClipsDir, { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });

  const shotPlan = buildShotPlan({ episodeId, prompt, scenes, stylePreset, aspectRatio });
  const continuity = buildContinuityManifest({ prompt, scenes, shotPlan });

  await fs.writeFile(
    path.join(episodeDir, "shot_plan.json"),
    JSON.stringify(shotPlan, null, 2),
    "utf-8"
  );
  await fs.writeFile(
    path.join(episodeDir, "continuity_manifest.json"),
    JSON.stringify(continuity, null, 2),
    "utf-8"
  );

  const providerAdapter = createSceneProvider(provider);
  const timeline = [];

  for (const scene of shotPlan.scenes) {
    const builtClips = [];
    for (const shot of scene.shots) {
      timeline.push({ ts: new Date().toISOString(), event: `generate ${shot.shotId}` });

      const generation = await providerAdapter.generateShotImage({
        episodeId,
        sceneId: scene.sceneId,
        shot,
        continuity,
        outputDir: shotsDir,
      });

      if (!generation.success) {
        timeline.push({ ts: new Date().toISOString(), event: `failed ${shot.shotId}`, error: generation.error });
        continue;
      }

      const clip = await buildShotClip({
        imagePath: generation.artifactPath,
        outputDir: shotClipsDir,
        shot,
      });

      builtClips.push(clip.outputPath);
      timeline.push({ ts: new Date().toISOString(), event: `clip built ${shot.shotId}` });
    }

    const sceneClip = await assembleSceneClip({
      outputDir: sceneClipsDir,
      scene,
      shotClipPaths: builtClips,
    });

    timeline.push({ ts: new Date().toISOString(), event: `scene assembled ${scene.sceneId}`, sceneClip });
  }

  await fs.writeFile(
    path.join(episodeDir, "generation_job.json"),
    JSON.stringify({ episodeId, provider, stylePreset, aspectRatio, timeline }, null, 2),
    "utf-8"
  );

  return { ok: true, episodeId, timeline };
}
