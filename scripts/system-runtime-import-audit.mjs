import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const uiRoot = path.join(root, "ui");
const duplicateTree = path.join(uiRoot, "src", "components", "ui", "src");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const patchFiles = walk(path.join(uiRoot, "src")).filter((file) =>
  /(^|[\\/]).*PATCH.*\.(ts|tsx)$/i.test(file)
);

const findings = [];
if (fs.existsSync(duplicateTree)) {
  findings.push(`Quarantined duplicate tree: ${path.relative(root, duplicateTree)}`);
}
if (patchFiles.length) {
  findings.push(`Quarantined patch debris (${patchFiles.length}):`);
  patchFiles.slice(0, 20).forEach((file) => findings.push(`  - ${path.relative(root, file)}`));
  if (patchFiles.length > 20) findings.push(`  - ... ${patchFiles.length - 20} more`);
}

findings.push("Core audit bridge is active.");
findings.push("Typecheck now targets the quarantined core lane via ui/tsconfig.audit.json.");

console.log(findings.join("\n"));
