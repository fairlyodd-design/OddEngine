import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = "v10.36.12";
const PASS_NAME = "RuntimeAuditAndCleanCheckpointPass";
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const gitBin = process.platform === "win32" ? "git.exe" : "git";

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}
function readText(p) { return fs.readFileSync(p, "utf8"); }
function sha256(p) {
  if (!exists(p)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}
function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function run(cmd, args, opts = {}) {
  const started = Date.now();
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd,
    encoding: "utf8",
    shell: false,
    env: process.env,
    maxBuffer: 1024 * 1024 * 64,
  });
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const code = typeof result.status === "number" ? result.status : (result.error ? 1 : 0);
  return { cmd: [cmd, ...args].join(" "), code, ms: Date.now() - started, stdout, stderr, error: result.error ? String(result.error.message || result.error) : null };
}
function findRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [process.cwd(), path.resolve(here, ".."), path.resolve(here, "../.."), path.resolve(process.cwd(), "..")];
  for (const candidate of candidates) {
    if (exists(path.join(candidate, "package.json")) && exists(path.join(candidate, "ui", "package.json")) && exists(path.join(candidate, "ui", "src", "App.tsx"))) return candidate;
  }
  throw new Error("Could not locate OddEngine root. Run this BAT from C:\\OddEngine after unzipping the pass.");
}
function line(title) { return `\n=== ${title} ===\n`; }
function collectSourceChecks(root) {
  const keyFiles = [
    "ui/src/App.tsx",
    "ui/src/styles.css",
    "ui/src/panels/Home.tsx",
    "ui/src/panels/Trading.tsx",
    "ui/src/components/ActivityRail.tsx",
    "ui/src/lib/lazyWithRetry.ts",
    "ui/src/components/SoftErrorGuard.tsx",
  ];
  const checks = [];
  const failures = [];
  const warnings = [];
  for (const rel of keyFiles) {
    const full = path.join(root, rel);
    const present = exists(full);
    checks.push({ rel, present, sha256: present ? sha256(full) : null });
    if (!present && !rel.includes("lazyWithRetry") && !rel.includes("SoftErrorGuard")) failures.push(`Missing required file: ${rel}`);
  }
  const homePath = path.join(root, "ui/src/panels/Home.tsx");
  if (exists(homePath)) {
    const home = readText(homePath);
    const operatorBrainImports = (home.match(/from\s+["']\.\.\/lib\/operatorBrain["']/g) || []).length;
    checks.push({ rel: "ui/src/panels/Home.tsx", check: "operatorBrain import count", value: operatorBrainImports });
    if (operatorBrainImports > 1) failures.push(`Home.tsx has duplicate operatorBrain imports: ${operatorBrainImports}`);
    if (home.includes("getGoals().split(/") && !home.includes("getGoals().split(/\\n+/)")) warnings.push("Home.tsx contains a getGoals().split(/...) pattern that should be checked if Home fails to parse.");
  }
  const railPath = path.join(root, "ui/src/components/ActivityRail.tsx");
  if (exists(railPath)) {
    const rail = readText(railPath);
    const hasTabState = /const\s+\[\s*tab\s*,\s*setTab\s*\]/.test(rail) || /useState\s*<[^>]*>\s*\(\s*["']Next["']\s*\)/.test(rail);
    checks.push({ rel: "ui/src/components/ActivityRail.tsx", check: "tab state present", value: hasTabState });
    if (!hasTabState) warnings.push("ActivityRail.tsx did not show the expected tab state pattern. If rail tab errors return, inspect this file.");
  }
  const tradingPath = path.join(root, "ui/src/panels/Trading.tsx");
  if (exists(tradingPath)) {
    const trading = readText(tradingPath);
    checks.push({ rel: "ui/src/panels/Trading.tsx", check: "contains stableDisplayChain", value: trading.includes("stableDisplayChain") });
    if (trading.includes("No contracts loaded yet") && !trading.includes("scan a symbol first")) warnings.push("Trading.tsx has the no-contract text, but the expected clean scan message was not detected.");
  }
  const mojibakeMarkers = ["\\u00c3", "\\u00c2", "\\u00e2", "\\u00f0", "\\u0178"].map((s) => JSON.parse(`"${s}"`));
  const mojibakeHits = [];
  for (const rel of keyFiles) {
    const full = path.join(root, rel);
    if (!exists(full)) continue;
    const text = readText(full);
    for (const marker of mojibakeMarkers) {
      if (text.includes(marker)) {
        mojibakeHits.push(`${rel} contains possible mojibake marker U+${marker.charCodeAt(0).toString(16).toUpperCase().padStart(4,"0")}`);
        break;
      }
    }
  }
  if (mojibakeHits.length) warnings.push(...mojibakeHits.slice(0, 12));
  const duplicateTree = path.join(root, "ui/src/components/ui/src");
  if (exists(duplicateTree)) warnings.push("Duplicate tree still exists at ui/src/components/ui/src. The audit bridge may quarantine it, but it should not grow.");
  const patchDebris = [];
  function walk(dir) {
    if (!exists(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/(^|[\\/]).*PATCH.*\.(ts|tsx)$/i.test(full)) patchDebris.push(path.relative(root, full));
    }
  }
  walk(path.join(root, "ui/src"));
  if (patchDebris.length) warnings.push(`Patch debris under ui/src: ${patchDebris.length} file(s).`);
  return { checks, failures, warnings };
}
function main() {
  const root = findRoot();
  process.chdir(root);
  const checkpointDir = path.join(root, "checkpoints", `${VERSION}_${PASS_NAME}_${nowStamp()}`);
  fs.mkdirSync(checkpointDir, { recursive: true });
  const reportPath = path.join(checkpointDir, "RUNTIME_AUDIT_REPORT.txt");
  const manifestPath = path.join(checkpointDir, "checkpoint-manifest.json");
  const report = [];
  const manifest = { version: VERSION, passName: PASS_NAME, createdAt: new Date().toISOString(), root, platform: process.platform, node: process.version, hostname: os.hostname(), sourceChecks: null, commands: [], git: {}, passed: false, tagCreated: false, tagName: `${VERSION}-clean` };
  report.push(`${VERSION}_${PASS_NAME}`);
  report.push(`Root: ${root}`);
  report.push(`Created: ${manifest.createdAt}`);
  report.push(`Node: ${process.version}`);
  report.push("");
  console.log(`[OddEngine] ${VERSION} Runtime Audit and Clean Checkpoint`);
  console.log(`[OddEngine] Root: ${root}`);
  const sourceChecks = collectSourceChecks(root);
  manifest.sourceChecks = sourceChecks;
  report.push(line("Source sanity checks"));
  report.push(JSON.stringify(sourceChecks, null, 2));
  if (sourceChecks.failures.length) {
    console.error("[OddEngine] Source sanity checks found blocking issue(s):");
    for (const f of sourceChecks.failures) console.error(`  - ${f}`);
  }
  if (sourceChecks.warnings.length) {
    console.warn("[OddEngine] Source sanity warnings:");
    for (const w of sourceChecks.warnings) console.warn(`  - ${w}`);
  }
  report.push(line("npm run audit:runtime"));
  console.log("[OddEngine] Running npm run audit:runtime...");
  const audit = run(npmBin, ["run", "audit:runtime"], { cwd: root });
  manifest.commands.push(audit);
  report.push(`$ ${audit.cmd}\nexit=${audit.code} durationMs=${audit.ms}\n`);
  report.push(audit.stdout);
  if (audit.stderr) report.push("\n[stderr]\n" + audit.stderr);
  report.push(line("npm run build:web"));
  console.log("[OddEngine] Running npm run build:web...");
  const build = run(npmBin, ["run", "build:web"], { cwd: root });
  manifest.commands.push(build);
  report.push(`$ ${build.cmd}\nexit=${build.code} durationMs=${build.ms}\n`);
  report.push(build.stdout);
  if (build.stderr) report.push("\n[stderr]\n" + build.stderr);
  report.push(line("Git checkpoint status"));
  const gitHead = run(gitBin, ["rev-parse", "--short", "HEAD"], { cwd: root });
  const gitStatus = run(gitBin, ["status", "--short"], { cwd: root });
  const gitBranch = run(gitBin, ["branch", "--show-current"], { cwd: root });
  manifest.git.head = gitHead.code === 0 ? gitHead.stdout.trim() : null;
  manifest.git.branch = gitBranch.code === 0 ? gitBranch.stdout.trim() : null;
  manifest.git.statusShort = gitStatus.code === 0 ? gitStatus.stdout : "";
  manifest.git.isClean = gitStatus.code === 0 && gitStatus.stdout.trim().length === 0;
  report.push(`Branch: ${manifest.git.branch || "(unknown)"}`);
  report.push(`HEAD: ${manifest.git.head || "(unknown)"}`);
  report.push(`Working tree clean: ${manifest.git.isClean ? "yes" : "no"}`);
  report.push(manifest.git.statusShort || "(no git status output)");
  const allPassed = sourceChecks.failures.length === 0 && audit.code === 0 && build.code === 0;
  manifest.passed = allPassed;
  if (allPassed && manifest.git.isClean) {
    const tagName = manifest.tagName;
    const tagExists = run(gitBin, ["rev-parse", "-q", "--verify", `refs/tags/${tagName}`], { cwd: root });
    if (tagExists.code === 0) {
      report.push(`\nTag already exists: ${tagName}`);
      manifest.tagCreated = false;
      manifest.git.tagNote = "already exists";
    } else {
      const tag = run(gitBin, ["tag", tagName], { cwd: root });
      manifest.commands.push(tag);
      manifest.tagCreated = tag.code === 0;
      report.push(`\nTag create attempted: ${tagName}`);
      report.push(`exit=${tag.code}`);
      if (tag.stdout) report.push(tag.stdout);
      if (tag.stderr) report.push(tag.stderr);
    }
  } else if (allPassed) {
    report.push(`\nAudit/build passed, but working tree is not clean, so no git tag was created.`);
    report.push(`To checkpoint after committing:`);
    report.push(`  git add .`);
    report.push(`  git commit -m "${VERSION} ${PASS_NAME}"`);
    report.push(`  git tag ${VERSION}-clean`);
    report.push(`  git push origin main --tags`);
  } else {
    report.push(`\nAudit/build did not pass. No git tag was created.`);
  }
  fs.writeFileSync(reportPath, report.join("\n"), "utf8");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log("");
  console.log(`[OddEngine] Report written: ${path.relative(root, reportPath)}`);
  console.log(`[OddEngine] Manifest written: ${path.relative(root, manifestPath)}`);
  if (!allPassed) {
    console.error("[OddEngine] v10.36.12 found blocking issue(s).");
    process.exit(1);
  }
  if (manifest.git.isClean) console.log(`[OddEngine] Clean checkpoint is ready${manifest.tagCreated ? ` and local tag ${manifest.tagName} was created.` : "."}`);
  else console.log("[OddEngine] Audit/build passed. Working tree has changes, so commit first before tagging.");
  process.exit(0);
}
try { main(); } catch (err) {
  console.error("[OddEngine] Fatal checkpoint runner error:");
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
}
