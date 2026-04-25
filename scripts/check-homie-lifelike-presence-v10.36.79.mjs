import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.79";
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
  "v10.36.79 checker-safe marker",
  "Warm companion lane open",
  "I’m here with you.",
  "Microsoft Aria",
]) {
  if (!buddy.includes(needle)) fail("Missing HomieBuddy marker/text: " + needle);
}

for (const needle of [
  "v10.36.79 checker-safe marker",
  "smoother pointer and softer talk pulse installed",
  "current.x += (target.x - current.x) * 0.12",
  "const pulseA = Math.abs(Math.sin(t * 6.8))",
]) {
  if (!rive.includes(needle)) fail("Missing Rive marker/text: " + needle);
}

for (const needle of [
  "v10.36.79 Homie lifelike presence + warm voice polish",
  "homieLifelikeAuraDrift",
  "homieLifelikeSpeakAura",
  ".homieRebuildAvatar{",
]) {
  if (!css.includes(needle)) fail("Missing CSS marker/text: " + needle);
}

console.log("[" + VERSION + "] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");