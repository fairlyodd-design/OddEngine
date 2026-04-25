import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.61";
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
  'data-homie-3d-companion-host="v10.36.61"',
  '<Homie3DCompanion activePanelId={activePanelId} onNavigate={onNavigate} />',
];

const requiredComponent = [
  "data-homie-3d-companion=v10.36.61",
  "data-homie-mic-camera-presence=v10.36.61",
  "data-homie-camera-truth-layer=v10.36.61",
  "@react-three/fiber",
  "getUserMedia",
  "SpeechRecognition",
  "speechSynthesis",
  "Camera signal",
  "Privacy off",
];

for (const marker of requiredHomie) {
  if (!homie.includes(marker)) fail(`Homie.tsx missing marker: ${marker}`);
}

for (const marker of requiredComponent) {
  if (!component.includes(marker)) fail(`Homie3DCompanion.tsx missing marker: ${marker}`);
}

for (const dep of ["three", "@react-three/fiber"]) {
  if (!pkg.includes(`"${dep}"`)) fail(`ui/package.json missing ${dep}`);
}

console.log(`[${VERSION}] CHECK PASSED: Homie 3D mic/cam companion markers are installed.`);
console.log(`[${VERSION}] Next: cd ui && npm run typecheck && npm run build`);
