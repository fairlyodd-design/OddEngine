import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const report = {
  pass: "v10.36.13b_CIRecoveryAuditCaseFixPass",
  root,
  startedAt: new Date().toISOString(),
  steps: [],
};

function run(label, command, args, options = {}) {
  console.log(`\n▶ ${label}`);
  console.log(`$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, CI: process.env.CI || "true" },
  });
  const ok = result.status === 0;
  report.steps.push({ label, command: [command, ...args], cwd: options.cwd || root, ok, status: result.status });
  if (!ok) {
    report.finishedAt = new Date().toISOString();
    report.ok = false;
    fs.writeFileSync(path.join(root, "ci-recovery-report.json"), JSON.stringify(report, null, 2));
    process.exit(result.status || 1);
  }
}

if (!fs.existsSync(path.join(root, "package.json"))) {
  throw new Error("Run this from the OddEngine repo root. package.json was not found.");
}
if (!fs.existsSync(path.join(root, "ui", "package.json"))) {
  throw new Error("Run this from the OddEngine repo root. ui/package.json was not found.");
}

run("Show Node version", "node", ["--version"]);
run("Show npm version", "npm", ["--version"]);
run("Install UI dependencies", "npm", ["--prefix", "ui", "install"]);
run("Runtime import audit", "node", ["scripts/system-runtime-import-audit.mjs"]);
run("Typecheck audit lane", "npm", ["--prefix", "ui", "run", "typecheck"]);
run("Build UI", "npm", ["--prefix", "ui", "run", "build"]);

const indexPath = path.join(root, "ui", "dist", "index.html");
if (!fs.existsSync(indexPath)) {
  throw new Error("Build finished but ui/dist/index.html was not created.");
}

report.finishedAt = new Date().toISOString();
report.ok = true;
report.distIndex = path.relative(root, indexPath);
fs.writeFileSync(path.join(root, "ci-recovery-report.json"), JSON.stringify(report, null, 2));
console.log("\n✅ v10.36.13b CI recovery check passed.");
console.log("Report written to ci-recovery-report.json");
