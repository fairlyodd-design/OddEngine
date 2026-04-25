import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.83";
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
const cssStart = "/* ===== v10.36.83 Homie realistic visual vibe polish ===== */";
const cssEnd = "/* ===== v10.36.83 Homie realistic visual vibe polish END ===== */";
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
  "  width: min(100%, 360px);",
  "  aspect-ratio: 1 / 1.14;",
  "  border-radius: 30px;",
  "  overflow: hidden;",
  "  background:",
  "    radial-gradient(320px 180px at 50% 0%, rgba(154,230,255,0.12), rgba(154,230,255,0) 72%),",
  "    radial-gradient(280px 180px at 50% 100%, rgba(255,170,220,0.10), rgba(255,170,220,0) 74%),",
  "    linear-gradient(180deg, rgba(19,26,44,0.96) 0%, rgba(9,13,23,0.97) 100%);",
  "  border: 1px solid rgba(154,230,255,0.16);",
  "  box-shadow:",
  "    0 24px 56px rgba(0,0,0,0.42),",
  "    0 0 48px rgba(94,234,242,0.10),",
  "    0 0 74px rgba(255,170,220,0.08);",
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
  "  gap: 10px;",
  "}",
  ".homieRebuildAvatarWrap{",
  "  padding-top: 6px;",
  "}",
  ".homieRebuildStageText{",
  "  gap: 4px;",
  "}",
  ".homieRebuildPresenceLine,",
  ".homieTolanIdlePresenceLine{",
  "  max-width: 42ch;",
  "  color: rgba(240,246,255,0.84);",
  "  text-shadow: 0 0 18px rgba(154,230,255,0.08);",
  "}",
  cssEnd
].join("\n") + "\n";
fs.writeFileSync(cssPath, css, "utf8");

console.log("[" + VERSION + "] Applied realistic visual vibe polish.");
console.log("Touched:");
console.log("- ui/src/components/RiveHomie.tsx");
console.log("- ui/src/components/homieRebuild.css");