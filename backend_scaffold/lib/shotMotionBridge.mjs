import fs from "node:fs/promises";
import path from "node:path";
import { createMotionProvider } from "./sceneMotionProviders/baseMotionProvider.mjs";

export async function buildShotMotion({
  motionProvider = "mock",
  shotId,
  sourceImagePath,
  outputDir,
  fallbackBuilder,
}) {
  await fs.mkdir(outputDir, { recursive: true });

  try {
    const provider = createMotionProvider(motionProvider);
    const result = await provider.generateMotionClip({
      shotId,
      sourceImagePath,
      outputDir,
    });
    if (result?.success) {
      return { ok: true, mode: "motion-generated", outputPath: result.outputPath };
    }
  } catch (error) {
    // fall through to still-motion fallback
  }

  const fallbackPath = path.join(outputDir, `${shotId}.fallback.mp4.txt`);
  await fs.writeFile(
    fallbackPath,
    JSON.stringify(
      {
        shotId,
        sourceImagePath,
        mode: "still-image-fallback",
      },
      null,
      2
    ),
    "utf-8"
  );

  if (typeof fallbackBuilder === "function") {
    await fallbackBuilder({ shotId, sourceImagePath, outputDir });
  }

  return { ok: true, mode: "still-image-fallback", outputPath: fallbackPath };
}
