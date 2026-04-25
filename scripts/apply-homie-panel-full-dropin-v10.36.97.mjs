import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.97";
const root = process.cwd();
const srcPath = path.join(root, "files", "ui", "src", "panels", "Homie.tsx");
const dstPath = path.join(root, "ui", "src", "panels", "Homie.tsx");

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

ensure(srcPath);
ensure(dstPath);
backup(dstPath);
fs.copyFileSync(srcPath, dstPath);

console.log("[" + VERSION + "] Applied full Homie panel drop-in rewrite.");
console.log("Touched:");
console.log("- ui/src/panels/Homie.tsx");