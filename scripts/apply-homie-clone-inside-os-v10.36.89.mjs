import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.89";
const root = process.cwd();

const appPath = path.join(root, "ui", "src", "App.tsx");
const brainPath = path.join(root, "ui", "src", "lib", "brain.ts");
const panelPath = path.join(root, "ui", "src", "panels", "HomieCloneStudio.tsx");
const panelSrcPath = path.join(root, "files", "ui", "src", "panels", "HomieCloneStudio.tsx");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}
function ensure(filePath) {
  if (!fs.existsSync(filePath)) fail("Missing file: " + filePath);
}
function backup(filePath) {
  const dst = filePath + ".bak_" + VERSION;
  if (!fs.existsSync(dst)) fs.copyFileSync(filePath, dst);
}
function writePanel() {
  fs.mkdirSync(path.dirname(panelPath), { recursive: true });
  fs.copyFileSync(panelSrcPath, panelPath);
}

ensure(appPath);
ensure(brainPath);
ensure(panelSrcPath);
backup(appPath);
backup(brainPath);
writePanel();

let app = fs.readFileSync(appPath, "utf8");
if (!app.includes('const HomieCloneStudio = lazy(() => import("./panels/HomieCloneStudio"));')) {
  const lazyMatch = app.match(/const\s+Homie\s*=\s*lazy\(\(\)\s*=>\s*import\("\.\/panels\/Homie"\)\);?/);
  if (!lazyMatch) fail("Could not find Homie lazy import anchor");
  app = app.replace(lazyMatch[0], lazyMatch[0] + '\nconst HomieCloneStudio = lazy(() => import("./panels/HomieCloneStudio"));');
}
if (!app.includes('case "HomieCloneStudio": return <HomieCloneStudio onNavigate={setActive} />;')) {
  const caseRegex = /case\s+"Homie":\s*return\s*<Homie[^;]+;\s*/m;
  if (caseRegex.test(app)) {
    app = app.replace(caseRegex, (m) => m + '    case "HomieCloneStudio": return <HomieCloneStudio onNavigate={setActive} />;\n');
  } else {
    const caseRegex2 = /case\s+"Homie":[\s\S]{0,300}?return\s*<Homie[\s\S]*?;\s*/m;
    if (caseRegex2.test(app)) {
      app = app.replace(caseRegex2, (m) => m + '    case "HomieCloneStudio": return <HomieCloneStudio onNavigate={setActive} />;\n');
    } else {
      fail("Could not find Homie render case anchor");
    }
  }
}
fs.writeFileSync(appPath, app, "utf8");

let brain = fs.readFileSync(brainPath, "utf8");
if (!brain.includes('id:"HomieCloneStudio"')) {
  const entry = '\n  { id:"HomieCloneStudio", icon:"🧬", title:"Homie Clone Studio", sub:"Profile + family voice workflow", section:"ODDENGINE", assistantName:"Clone Guide", assistantRole:"Tone, phrases, memory, and consent-first voice workflow", description:"Edits the Homie clone profile, family phrases, preview shaping, and family voice training workflow from inside the OS.", quickPrompts:["Make Homie feel more like me.","Edit my family phrases and tone.","Generate the next safe voice training manifest."], storageKeys:["oddengine:homieCloneStudio:draft:v1"], nextSteps:["Start with signature tone and likeness notes.","Save 5–10 family phrases before training anything.","Use only consent-first voice samples."], actions:[{ id:"homie", label:"Open Homie", kind:"navigate", panelId:"Homie" },{ id:"books", label:"Open Writers Lounge", kind:"navigate", panelId:"Books" }] },';
  const arrayEnd = brain.lastIndexOf("];");
  if (arrayEnd === -1) fail("Could not find PANEL_META array end");
  brain = brain.slice(0, arrayEnd) + entry + "\n" + brain.slice(arrayEnd);
}
fs.writeFileSync(brainPath, brain, "utf8");

console.log("[" + VERSION + "] Applied Homie Clone Editor Inside OS pass.");
console.log("Touched:");
console.log("- ui/src/panels/HomieCloneStudio.tsx");
console.log("- ui/src/App.tsx");
console.log("- ui/src/lib/brain.ts");
