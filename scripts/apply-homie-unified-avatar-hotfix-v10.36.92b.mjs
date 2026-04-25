import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.92b";
const root = process.cwd();

const componentPath = path.join(root, "ui", "src", "components", "HomieUnifiedAvatar.tsx");
const cssPath = path.join(root, "ui", "src", "components", "homieRebuild.css");
const srcComponentPath = path.join(root, "files", "ui", "src", "components", "HomieUnifiedAvatar.tsx");

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

ensure(componentPath);
ensure(cssPath);
ensure(srcComponentPath);
backup(componentPath);
backup(cssPath);

fs.copyFileSync(srcComponentPath, componentPath);

let css = fs.readFileSync(cssPath, "utf8");
const start = "/* ===== v10.36.92b Homie unified avatar stage render hotfix ===== */";
const end = "/* ===== v10.36.92b Homie unified avatar stage render hotfix END ===== */";
if (css.includes(start) && css.includes(end)) {
  const s = css.indexOf(start);
  const e = css.indexOf(end, s) + end.length;
  css = (css.slice(0, s) + css.slice(e)).trimEnd();
}

css += "\n\n" + [
  start,
  ".homieUnifiedAvatarRoot{",
  "  width: 100%;",
  "  display: grid;",
  "  gap: 10px;",
  "  justify-items: center;",
  "}",
  ".homieUnifiedAvatarStage{",
  "  width: 100%;",
  "  min-height: 400px;",
  "  display: grid;",
  "  place-items: center;",
  "  border: 1px solid rgba(154,230,255,0.12);",
  "  border-radius: 26px;",
  "  background:",
  "    radial-gradient(320px 180px at 50% 0%, rgba(154,230,255,0.08), rgba(154,230,255,0) 72%),",
  "    radial-gradient(260px 160px at 50% 100%, rgba(255,170,220,0.07), rgba(255,170,220,0) 74%),",
  "    rgba(5,10,20,0.24);",
  "}",
  ".homieUnifiedAvatarRive,",
  ".homieUnifiedAvatarRive .homieRiveWrap,",
  ".homieUnifiedAvatarRive .homieCanvasFallbackWrap{",
  "  width: 100%;",
  "  display: flex;",
  "  align-items: center;",
  "  justify-content: center;",
  "}",
  ".homieUnifiedAvatarRive .homieRiveClip,",
  ".homieUnifiedAvatarRive .homieCanvasFallbackClip{",
  "  width: min(100%, 372px);",
  "  aspect-ratio: 1 / 1.18;",
  "}",
  ".homieUnifiedAvatarRive .homieRiveCanvas,",
  ".homieUnifiedAvatarRive .homieCanvasFallbackCanvas{",
  "  width: 100%;",
  "  height: 100%;",
  "  display: block;",
  "}",
  ".homieUnifiedAvatarFallbackShell{",
  "  width: min(100%, 372px);",
  "  aspect-ratio: 1 / 1.18;",
  "  border-radius: 34px;",
  "  border: 1px solid rgba(154,230,255,0.14);",
  "  background:",
  "    radial-gradient(340px 190px at 50% 0%, rgba(154,230,255,0.12), rgba(154,230,255,0) 72%),",
  "    radial-gradient(290px 180px at 50% 100%, rgba(255,170,220,0.10), rgba(255,170,220,0) 74%),",
  "    linear-gradient(180deg, rgba(20,28,45,0.97) 0%, rgba(9,13,23,0.98) 100%);",
  "  display: grid;",
  "  place-items: center;",
  "  box-shadow:",
  "    0 26px 62px rgba(0,0,0,0.44),",
  "    0 0 56px rgba(94,234,242,0.11),",
  "    0 0 82px rgba(255,170,220,0.08);",
  "}",
  ".homieUnifiedAvatarFallbackLabel{",
  "  color: rgba(236,246,255,0.72);",
  "  font-size: 12px;",
  "  letter-spacing: 0.02em;",
  "  text-transform: uppercase;",
  "}",
  ".homieUnifiedAvatarCaption{",
  "  max-width: 42ch;",
  "}",
  ".homieUnifiedAvatarRoot.compact .homieUnifiedAvatarStage{",
  "  min-height: 280px;",
  "}",
  end
].join("\n") + "\n";

fs.writeFileSync(cssPath, css, "utf8");

console.log("[" + VERSION + "] Applied Homie unified avatar stage render hotfix.");
console.log("Touched:");
console.log("- ui/src/components/HomieUnifiedAvatar.tsx");
console.log("- ui/src/components/homieRebuild.css");