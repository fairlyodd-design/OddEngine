import fs from "node:fs/promises";
import path from "node:path";

export function createMockProvider() {
  return {
    async generateShotImage({ shot, outputDir }) {
      const safeName = `${shot.shotId}.txt`;
      const outputPath = path.join(outputDir, safeName);
      const payload = [
        `MOCK IMAGE PLACEHOLDER FOR ${shot.shotId}`,
        `PROMPT: ${shot.visualPrompt}`,
        `NEGATIVE: ${shot.negativePrompt}`,
      ].join("\n");
      await fs.writeFile(outputPath, payload, "utf-8");
      return {
        success: true,
        artifactPath: outputPath,
        model: "mock-provider",
        provider: "mock",
        width: 1280,
        height: 720,
        durationMs: 50,
      };
    },
  };
}
