import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.85";
const root = process.cwd();
const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");
const rivePath = path.join(root, "ui", "src", "components", "RiveHomie.tsx");
const cssPath = path.join(root, "ui", "src", "components", "homieRebuild.css");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}
for (const file of [buddyPath, rivePath, cssPath]) {
  if (!fs.existsSync(file)) fail("Missing file: " + file);
}

const buddy = fs.readFileSync(buddyPath, "utf8");
const rive = fs.readFileSync(rivePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

for (const needle of [
  "v10.36.85 checker-safe marker",
  "function detectHomieSpeechEmotion",
  "function applyHomiePremiumVoiceEmotionStyle",
  "Warm companion lane open",
  "Calm companion mode — present, warm, and ready.",
]) {
  if (!buddy.includes(needle)) fail("Missing HomieBuddy marker/text: " + needle);
}

for (const needle of [
  "v10.36.85 checker-safe marker",
  "gestureWave",
  "gestureWink",
  "gestureNod",
  "gestureTilt",
  "gestureSpark",
  "Canvas presence",
]) {
  if (!rive.includes(needle)) fail("Missing Rive marker/text: " + needle);
}

for (const needle of [
  "v10.36.85 Homie premium voice cadence + subtle gesture",
  ".homieCanvasFallbackClip{",
  ".homieCanvasFallbackBadge{",
]) {
  if (!css.includes(needle)) fail("Missing CSS marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");