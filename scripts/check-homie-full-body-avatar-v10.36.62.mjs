import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.62";
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

const homie = read("ui/src/panels/Homie.tsx");
const component = read("ui/src/components/Homie3DCompanion.tsx");
const pkg = read("ui/package.json");

const requiredHomie = [
  'Homie3DCompanion from "../components/Homie3DCompanion"',
  '<Homie3DCompanion activePanelId={activePanelId} onNavigate={onNavigate} />',
  'v10.36.62 checker-safe marker',
];
const requiredComponent = [
  'data-homie-3d-companion=v10.36.61',
  'data-homie-soft-body-avatar=v10.36.62',
  'data-homie-not-orb-mode=v10.36.62',
  'Homie 3D Companion — full body mode',
  'Full body avatar',
  'leftWing',
  'rightWing',
  'leftArm',
  'rightArm',
  'antenna',
  'CanvasRenderingContext2D | null',
  'getUserMedia',
  'SpeechRecognition',
  'speechSynthesis',
  'Privacy off',
];
for (const marker of requiredHomie) if (!homie.includes(marker)) fail(`Homie.tsx missing marker: ${marker}`);
for (const marker of requiredComponent) if (!component.includes(marker)) fail(`Homie3DCompanion.tsx missing marker: ${marker}`);
for (const dep of ["three", "@react-three/fiber", "@react-three/drei"]) {
  if (!pkg.includes(`"${dep}"`)) fail(`ui/package.json missing ${dep}`);
}
if (component.includes('homie3dOrbLabel')) fail('Old orb label class still present. Expected full-body stage badges.');
console.log(`[${VERSION}] CHECK PASSED: Homie full-body not-orb companion polish is installed.`);
console.log(`[${VERSION}] Next: cd ui && npm run typecheck && npm run build`);
