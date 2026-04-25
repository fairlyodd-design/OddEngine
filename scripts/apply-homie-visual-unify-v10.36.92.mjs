import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.92";
const root = process.cwd();

const homiePath = path.join(root, "ui", "src", "panels", "Homie.tsx");
const appCompDir = path.join(root, "ui", "src", "components");
const unifiedPath = path.join(appCompDir, "HomieUnifiedAvatar.tsx");
const srcUnifiedPath = path.join(root, "files", "ui", "src", "components", "HomieUnifiedAvatar.tsx");

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
function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) fail("Could not find anchor: " + label);
  return text.replace(from, to);
}

ensure(homiePath);
ensure(srcUnifiedPath);
fs.mkdirSync(appCompDir, { recursive: true });
backup(homiePath);

fs.copyFileSync(srcUnifiedPath, unifiedPath);

let src = fs.readFileSync(homiePath, "utf8");

if (!src.includes('import HomieUnifiedAvatar from "../components/HomieUnifiedAvatar";')) {
  src = replaceOnce(
    src,
    'import { getOperatorBrainSnapshot, runOperatorBrainNextAction } from "../lib/operatorBrain";',
    'import { getOperatorBrainSnapshot, runOperatorBrainNextAction } from "../lib/operatorBrain";\nimport HomieUnifiedAvatar from "../components/HomieUnifiedAvatar";',
    "Homie import HomieUnifiedAvatar"
  );
}

const aiGridAnchor = '<div className="grid2" style={{ alignItems: "start", marginTop: 8 }}>';
if (!src.includes('data-homie-visual-unify="v10.36.92"')) {
  const block = `
          <div className="card softCard" data-homie-visual-unify="v10.36.92" style={{ marginTop: 12, borderColor: "rgba(154,230,255,0.24)" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Unified companion preview</div>
                <div className="sub">Web and desktop now lead with the same avatar lane first. The older experimental stage stays below only as a temporary reference until it is fully retired.</div>
              </div>
              <span className={\`badge \${voiceSnapshot.listening ? "good" : "muted"}\`}>{voiceSnapshot.listening ? "Listening" : "Visual lane ready"}</span>
            </div>

            <div className="grid2" style={{ alignItems: "start", marginTop: 12 }}>
              <div className="card" style={{ background: "rgba(6,12,24,0.38)", borderColor: "rgba(154,230,255,0.14)" }}>
                <HomieUnifiedAvatar
                  mood={voiceSnapshot.listening ? "good" : "idle"}
                  isListening={voiceSnapshot.listening}
                  isSpeaking={busy}
                  gesture={voiceSnapshot.listening ? "tilt" : "none"}
                />
              </div>

              <div className="card" style={{ background: "rgba(6,12,24,0.38)", borderColor: "rgba(154,230,255,0.14)" }}>
                <div className="h">Why this pass helps</div>
                <div className="sub">Less visual confusion. The same hoodie/beard/glasses companion lane now shows up first instead of the older purple stage taking over the main visual impression.</div>

                <div className="assistantChipWrap" style={{ marginTop: 12 }}>
                  <span className="badge">Web + desktop aligned</span>
                  <span className="badge">Memoji-inspired</span>
                  <span className="badge">Desktop-safe fallback</span>
                  <span className="badge warn">Legacy stage still below</span>
                </div>

                <div className="timelineCard" style={{ marginTop: 12 }}>
                  <b>Best next move:</b> use this as the main visual reference, then retire or fully replace the old experimental stage in the next cleanup pass.
                </div>

                <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                  <button className="tabBtn active" onClick={() => addQuick("Keep Homie in the unified hoodie avatar lane and retire the older purple stage next.")}>Lock this visual lane</button>
                  <button className="tabBtn" onClick={() => onNavigate("HomieCloneStudio")}>Open Clone Studio</button>
                  <button className="tabBtn" onClick={() => onNavigate("Books")}>Open Writers Lounge</button>
                  <button className="tabBtn" onClick={() => onNavigate("Preferences")}>Open Preferences</button>
                </div>

                <div className="small" style={{ marginTop: 10 }}>
                  Honest note: this pass unifies the lead avatar lane first. It does not yet fully delete the older experimental stage below.
                </div>
              </div>
            </div>
          </div>

`;
  src = replaceOnce(src, aiGridAnchor, block + aiGridAnchor, "Homie AI grid anchor");
}

const replacements = [
  ['>Full body avatar<', '>Unified preview<', 'legacy badge text'],
  ['>Web fallback<', '>Older preview<', 'legacy badge 2'],
  ['Homie 3D Companion — full body mode', 'Legacy avatar stage', 'legacy stage heading'],
  ['Definitely not just an orb anymore lol.', 'Older experimental visual lane kept temporarily while the unified hoodie companion becomes the main reference.', 'legacy body copy'],
];

for (const [from, to] of replacements) {
  if (src.includes(from) && !src.includes(to)) {
    src = src.replace(from, to);
  }
}

if (!src.includes('data-homie-visual-unify="v10.36.92"')) {
  fail("Unified visual lane block was not inserted.");
}

fs.writeFileSync(homiePath, src, "utf8");

console.log("[" + VERSION + "] Applied Homie visual lane unify web and desktop avatar pass.");
console.log("Touched:");
console.log("- ui/src/components/HomieUnifiedAvatar.tsx");
console.log("- ui/src/panels/Homie.tsx");