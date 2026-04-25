import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.89b";
const root = process.cwd();
const panelPath = path.join(root, "ui", "src", "panels", "HomieCloneStudio.tsx");

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

ensure(panelPath);
backup(panelPath);

let src = fs.readFileSync(panelPath, "utf8");

const bad = '            Format: [{"text":"Keep the room calm.","lane":"family","notes":"core tone"}]';
const good = '            Format: <code className="mono">{\'[{"text":"Keep the room calm.","lane":"family","notes":"core tone"}]\'}</code>';

if (!src.includes(good)) {
  if (!src.includes(bad)) fail("Could not find the bad JSX literal example in HomieCloneStudio.tsx");
  src = src.replace(bad, good);
}

if (!src.includes("v10.36.89b checker-safe marker")) {
  src = src.replace(
    'import React, { useEffect, useMemo, useState } from "react";',
    'import React, { useEffect, useMemo, useState } from "react";\n// v10.36.89b checker-safe marker: JSX literal example hotfixed'
  );
}

fs.writeFileSync(panelPath, src, "utf8");

console.log("[" + VERSION + "] Applied JSX literal hotfix.");
console.log("Touched:");
console.log("- ui/src/panels/HomieCloneStudio.tsx");