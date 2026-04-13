import fs from "node:fs/promises";
import path from "node:path";

export async function assembleSceneClip({ outputDir, scene, shotClipPaths = [] }) {
  const outputPath = path.join(outputDir, `${scene.sceneId}.mp4.txt`);
  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        sceneId: scene.sceneId,
        title: scene.title,
        clips: shotClipPaths,
      },
      null,
      2
    ),
    "utf-8"
  );
  return outputPath;
}
