import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.84";
const root = process.cwd();

const rivePath = path.join(root, "ui", "src", "components", "RiveHomie.tsx");
const cssPath = path.join(root, "ui", "src", "components", "homieRebuild.css");

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

ensure(rivePath);
ensure(cssPath);
backup(rivePath);
backup(cssPath);

const newRive = fs.readFileSync(path.join(root, "files", "ui", "src", "components", "RiveHomie.tsx"), "utf8");
fs.writeFileSync(rivePath, newRive, "utf8");

let css = fs.readFileSync(cssPath, "utf8");
const cssStart = "/* ===== v10.36.84 Homie micro-expressions + premium idle presence ===== */";
const cssEnd = "/* ===== v10.36.84 Homie micro-expressions + premium idle presence END ===== */";
if (css.includes(cssStart) && css.includes(cssEnd)) {
  const s = css.indexOf(cssStart);
  const e = css.indexOf(cssEnd, s) + cssEnd.length;
  css = (css.slice(0, s) + css.slice(e)).trimEnd();
}
css += "\n\n" + [
  cssStart,
  ".homieCanvasFallbackWrap{",
  "  position: relative;",
  "  display: inline-flex;",
  "  width: 100%;",
  "  justify-content: center;",
  "  align-items: center;",
  "}",
  ".homieCanvasFallbackClip{",
  "  width: min(100%, 368px);",
  "  aspect-ratio: 1 / 1.15;",
  "  border-radius: 32px;",
  "  overflow: hidden;",
  "  background:",
  "    radial-gradient(340px 190px at 50% 0%, rgba(154,230,255,0.13), rgba(154,230,255,0) 72%),",
  "    radial-gradient(290px 190px at 50% 100%, rgba(255,170,220,0.11), rgba(255,170,220,0) 74%),",
  "    linear-gradient(180deg, rgba(22,29,48,0.97) 0%, rgba(9,13,23,0.98) 100%);",
  "  border: 1px solid rgba(154,230,255,0.16);",
  "  box-shadow:",
  "    0 26px 62px rgba(0,0,0,0.44),",
  "    0 0 52px rgba(94,234,242,0.11),",
  "    0 0 78px rgba(255,170,220,0.08);",
  "}",
  ".homieCanvasFallbackCanvas{",
  "  width: 100%;",
  "  height: 100%;",
  "  display: block;",
  "}",
  ".homieCanvasFallbackBadge{",
  "  position: absolute;",
  "  top: 12px;",
  "  right: 12px;",
  "  z-index: 2;",
  "  padding: 6px 10px;",
  "  border-radius: 999px;",
  "  border: 1px solid rgba(94,234,242,0.18);",
  "  background: rgba(94,234,242,0.08);",
  "  color: rgba(221,245,255,0.92);",
  "  font-size: 12px;",
  "  line-height: 1;",
  "  letter-spacing: 0.01em;",
  "}",
  ".homieCanvasFallbackNode{",
  "  display: none;",
  "}",
  ".homieRebuildStage{",
  "  gap: 9px;",
  "}",
  ".homieRebuildAvatarWrap{",
  "  padding-top: 6px;",
  "}",
  ".homieRebuildStageText{",
  "  gap: 4px;",
  "}",
  ".homieRebuildPresenceLine,",
  ".homieTolanIdlePresenceLine{",
  "  max-width: 40ch;",
  "  color: rgba(241,247,255,0.86);",
  "  text-shadow: 0 0 20px rgba(154,230,255,0.08);",
  "}",
  cssEnd
].join("\n") + "\n";
fs.writeFileSync(cssPath, css, "utf8");

console.log("[" + VERSION + "] Applied micro-expressions and premium idle presence.");
console.log("Touched:");
console.log("- ui/src/components/RiveHomie.tsx");
console.log("- ui/src/components/homieRebuild.css");