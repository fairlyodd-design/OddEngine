import fs from "node:fs/promises";
import path from "node:path";

export async function buildShotClip({ imagePath, outputDir, shot }) {
  const outputPath = path.join(outputDir, `${shot.shotId}.mp4.txt`);
  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        sourceImage: imagePath,
        shotId: shot.shotId,
        motionPreset: "cinematic-slow",
        camera: shot.camera,
        durationSec: shot.durationSec,
      },
      null,
      2
    ),
    "utf-8"
  );
  return { ok: true, outputPath };
}
