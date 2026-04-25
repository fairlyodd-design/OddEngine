
import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.63";
const repoRoot = process.cwd();
function fail(msg) {
  console.error(`[${VERSION}] CHECK FAILED: ${msg}`);
  process.exit(1);
}
function read(rel) {
  const filePath = path.join(repoRoot, rel);
  if (!fs.existsSync(filePath)) fail(`Missing ${rel}`);
  return fs.readFileSync(filePath, "utf8");
}
const buddy = read("ui/src/components/HomieBuddy.tsx");
const css = read("ui/src/components/homieRebuild.css");
const requiredBuddy = [
  "v10.36.63 checker-safe marker",
  'data-homie-buddy-fullbody-avatar="v10.36.63"',
  "homieFullBodyCore",
  "homieFullBodyHead",
  "homieFullBodyTorso",
  "homieFullBodyWing",
  "homieFullBodyMouth",
];
const requiredCss = [
  "v10.36.63 Homie Buddy Big Stage Full-Body Companion",
  ".homieFullBodyCore",
  ".homieFullBodyHead",
  ".homieFullBodyTorso",
  ".homieFullBodyWing",
  ".homieFullBodyArm",
  ".homieFullBodyLeg",
  "homieFullBodyBreathe",
  "homieFullBodyTalk",
  "width: 250px !important",
  "height: 318px !important",
];
for (const marker of requiredBuddy) if (!buddy.includes(marker)) fail(`HomieBuddy.tsx missing marker: ${marker}`);
for (const marker of requiredCss) if (!css.includes(marker)) fail(`homieRebuild.css missing marker: ${marker}`);
if (buddy.includes('homieOrbLabel">Homie')) fail("Old Homie orb text label still present in avatarContents block.");
console.log(`[${VERSION}] CHECK PASSED: Homie Buddy big-stage full-body companion avatar is installed.`);
console.log(`[${VERSION}] Next: cd ui && npm run typecheck && npm run build`);
