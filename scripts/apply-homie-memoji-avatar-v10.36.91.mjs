import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.91";
const root = process.cwd();
const rivePath = path.join(root, "ui", "src", "components", "RiveHomie.tsx");
const cssPath = path.join(root, "ui", "src", "components", "homieRebuild.css");
const srcRive = path.join(root, "files", "ui", "src", "components", "RiveHomie.tsx");

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
ensure(srcRive);
backup(rivePath);
backup(cssPath);

fs.copyFileSync(srcRive, rivePath);

let css = fs.readFileSync(cssPath, "utf8");
const start = "/* ===== v10.36.91 Homie memoji-inspired full-body hoodie avatar ===== */";
const end = "/* ===== v10.36.91 Homie memoji-inspired full-body hoodie avatar END ===== */";
if (css.includes(start) && css.includes(end)) {
  const s = css.indexOf(start);
  const e = css.indexOf(end, s) + end.length;
  css = (css.slice(0, s) + css.slice(e)).trimEnd();
}

css += "\n\n" + [
  start,
  ".homieCanvasFallbackWrap{",
  "  position: relative;",
  "  display: inline-flex;",
  "  width: 100%;",
  "  justify-content: center;",
  "  align-items: center;",
  "}",
  ".homieCanvasFallbackClip{",
  "  width: min(100%, 372px);",
  "  aspect-ratio: 1 / 1.18;",
  "  overflow: hidden;",
  "  border-radius: 34px;",
  "  border: 1px solid rgba(154,230,255,0.16);",
  "  background:",
  "    radial-gradient(340px 190px at 50% 0%, rgba(154,230,255,0.12), rgba(154,230,255,0) 72%),",
  "    radial-gradient(290px 180px at 50% 100%, rgba(255,170,220,0.10), rgba(255,170,220,0) 74%),",
  "    linear-gradient(180deg, rgba(20,28,45,0.97) 0%, rgba(9,13,23,0.98) 100%);",
  "  box-shadow:",
  "    0 26px 62px rgba(0,0,0,0.44),",
  "    0 0 56px rgba(94,234,242,0.11),",
  "    0 0 82px rgba(255,170,220,0.08);",
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
  "  border: 1px solid rgba(154,230,255,0.18);",
  "  background: rgba(154,230,255,0.08);",
  "  color: rgba(234,245,255,0.92);",
  "  font-size: 12px;",
  "  letter-spacing: 0.01em;",
  "}",
  ".homieCanvasFallbackNode{",
  "  position: absolute;",
  "  inset: 0;",
  "  display: grid;",
  "  place-items: center;",
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
  "  color: rgba(241,247,255,0.85);",
  "  text-shadow: 0 0 18px rgba(154,230,255,0.08);",
  "}",
  end
].join("\n") + "\n";

fs.writeFileSync(cssPath, css, "utf8");

console.log("[" + VERSION + "] Applied Homie memoji-inspired full-body hoodie avatar pass.");
console.log("Touched:");
console.log("- ui/src/components/RiveHomie.tsx");
console.log("- ui/src/components/homieRebuild.css");