import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.82";
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
function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) fail("Could not find anchor: " + label);
  return text.replace(from, to);
}

ensure(rivePath);
ensure(cssPath);
backup(rivePath);
backup(cssPath);

const newRive = fs.readFileSync(path.join(root, "files", "ui", "src", "components", "RiveHomie.tsx"), "utf8");
fs.mkdirSync(path.dirname(rivePath), { recursive: true });
fs.writeFileSync(rivePath, newRive, "utf8");

let css = fs.readFileSync(cssPath, "utf8");
const cssStart = "/* ===== v10.36.82 Homie desktop canvas fallback + launcher polish ===== */";
const cssEnd = "/* ===== v10.36.82 Homie desktop canvas fallback + launcher polish END ===== */";
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
  "  width: min(100%, 340px);",
  "  aspect-ratio: 1 / 1.12;",
  "  border-radius: 28px;",
  "  overflow: hidden;",
  "  background:",
  "    radial-gradient(320px 180px at 50% 0%, rgba(154,230,255,0.10), rgba(154,230,255,0) 70%),",
  "    radial-gradient(260px 180px at 50% 100%, rgba(255,170,220,0.08), rgba(255,170,220,0) 70%),",
  "    rgba(8,13,22,0.82);",
  "  border: 1px solid rgba(154,230,255,0.16);",
  "  box-shadow:",
  "    0 18px 44px rgba(0,0,0,0.34),",
  "    0 0 38px rgba(94,234,242,0.08);",
  "}",
  ".homieCanvasFallbackCanvas{",
  "  width: 100%;",
  "  height: 100%;",
  "  display: block;",
  "}",
  ".homieCanvasFallbackBadge{",
  "  position: absolute;",
  "  top: 10px;",
  "  right: 10px;",
  "  z-index: 2;",
  "  padding: 6px 10px;",
  "  border-radius: 999px;",
  "  border: 1px solid rgba(94,234,242,0.18);",
  "  background: rgba(94,234,242,0.08);",
  "  color: rgba(221,245,255,0.92);",
  "  font-size: 12px;",
  "  line-height: 1;",
  "  box-shadow: 0 0 0 1px rgba(255,255,255,0.015) inset;",
  "}",
  ".homieCanvasFallbackNode{",
  "  display: none;",
  "}",
  cssEnd
].join("\n") + "\n";
fs.writeFileSync(cssPath, css, "utf8");

console.log("[" + VERSION + "] Applied desktop canvas avatar fallback and launcher polish prep.");
console.log("Touched:");
console.log("- ui/src/components/RiveHomie.tsx");
console.log("- ui/src/components/homieRebuild.css");