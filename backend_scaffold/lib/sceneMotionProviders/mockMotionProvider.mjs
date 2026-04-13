import fs from "node:fs/promises";
import path from "node:path";

export function createMockMotionProvider() {
  return {
    async generateMotionClip({ shotId, sourceImagePath, outputDir }) {
      const outputPath = path.join(outputDir, `${shotId}.motion.mp4.txt`);
      await fs.writeFile(
        outputPath,
        JSON.stringify(
          {
            shotId,
            sourceImagePath,
            generatedBy: "mock-motion-provider",
            motion: "simulated image-to-video output",
          },
          null,
          2
        ),
        "utf-8"
      );
      return { success: true, outputPath, provider: "mock-motion-provider" };
    },
  };
}
