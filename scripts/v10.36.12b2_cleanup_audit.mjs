import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const PASS = "v10.36.12b2_QuarantineDebrisAndMojibakeAuditRepairPass_LegacySafeHotfix";
const root = process.cwd();
const now = new Date();
const stamp = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
  "_",
  String(now.getHours()).padStart(2, "0"),
  String(now.getMinutes()).padStart(2, "0"),
  String(now.getSeconds()).padStart(2, "0"),
].join("");

const checkpointDir = path.join(root, "checkpoints", `${PASS}_${stamp}`);
const quarantineDir = path.join(checkpointDir, "quarantine");
fs.mkdirSync(quarantineDir, { recursive: true });

const reportLines = [];
const manifest = {
  pass: PASS,
  root,
  startedAt: now.toISOString(),
  moved: [],
  repaired: [],
  warnings: [],
  commands: [],
};

function log(line = "") {
  console.log(line);
  reportLines.push(line);
}

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function safeRelative(from, to) {
  // Node path.relative is used here instead of .NET GetRelativePath, so this works on older PowerShell/.NET.
  const rel = path.relative(from, to);
  return rel || path.basename(to);
}

function safeQuarantinePath(originalPath, reason) {
  const rel = safeRelative(root, originalPath)
    .split(path.sep)
    .join("__")
    .replace(/[^a-zA-Z0-9._-]+/g, "_");

  let target = path.join(quarantineDir, `${rel}`);
  if (exists(target)) {
    const ext = path.extname(target);
    const stem = target.slice(0, target.length - ext.length);
    let n = 2;
    while (exists(`${stem}_${n}${ext}`)) n += 1;
    target = `${stem}_${n}${ext}`;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(originalPath, target);
  manifest.moved.push({
    from: safeRelative(root, originalPath),
    to: safeRelative(root, target),
    reason,
  });
  log(`  - quarantined ${safeRelative(root, originalPath)} -> ${safeRelative(root, target)}`);
}

function walk(dir, out = []) {
  if (!exists(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const cp1252Reverse = new Map([
  [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C],
  [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93],
  [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B],
  [0x0153, 0x9C], [0x017E, 0x9E], [0x0178, 0x9F],
]);

function mojibakeScore(text) {
  let score = 0;
  const suspicious = [
    "\u00C3", "\u00C2", "\u00E2", "\u00F0", "\u0178", "\uFFFD",
    "\u00A2\u00E2", "\u00E2\u20AC", "\u00F0\u0178"
  ];
  for (const marker of suspicious) {
    let idx = text.indexOf(marker);
    while (idx !== -1) {
      score += marker.length > 1 ? 4 : 1;
      idx = text.indexOf(marker, idx + marker.length);
    }
  }
  return score;
}

function cp1252BytesFromString(text) {
  const bytes = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp <= 0xFF) {
      bytes.push(cp);
    } else if (cp1252Reverse.has(cp)) {
      bytes.push(cp1252Reverse.get(cp));
    } else {
      return null;
    }
  }
  return Buffer.from(bytes);
}

function tryRepairMojibake(text) {
  let best = text;
  let bestScore = mojibakeScore(text);

  for (let round = 0; round < 3; round += 1) {
    const bytes = cp1252BytesFromString(best);
    if (!bytes) break;
    const decoded = bytes.toString("utf8");
    const decodedScore = mojibakeScore(decoded);
    if (decoded.includes("\uFFFD") && !best.includes("\uFFFD")) break;
    if (decodedScore < bestScore) {
      best = decoded;
      bestScore = decodedScore;
    } else {
      break;
    }
  }

  // Targeted safe replacements for common UI damage.
  const replacements = [
    ["\u00E2\u20AC\u201D", "—"],
    ["\u00E2\u20AC\u201C", "–"],
    ["\u00E2\u20AC\u02DC", "‘"],
    ["\u00E2\u20AC\u2122", "’"],
    ["\u00E2\u20AC\u0153", "“"],
    ["\u00E2\u20AC\u009D", "”"],
    ["\u00E2\u20AC\u00A2", "•"],
    ["\u00E2\u20AC\u00A6", "…"],
    ["\u00F0\u0178\u2018\u0160", "👊"],
    ["\u00F0\u0178\u0090\u00A6\u00E2\u20AC\u008D\u00F0\u0178\u201D\u00A5", "🐦‍🔥"],
  ];
  for (const [bad, good] of replacements) {
    best = best.split(bad).join(good);
  }

  return best;
}

function repairFile(file) {
  const beforeBuf = fs.readFileSync(file);
  let before = beforeBuf.toString("utf8");
  const beforeScore = mojibakeScore(before);
  if (beforeScore <= 0) return false;

  const after = tryRepairMojibake(before);
  const afterScore = mojibakeScore(after);
  if (after !== before && afterScore <= beforeScore) {
    fs.writeFileSync(file, after, { encoding: "utf8" });
    manifest.repaired.push({
      file: safeRelative(root, file),
      beforeScore,
      afterScore,
    });
    log(`  - repaired mojibake markers in ${safeRelative(root, file)} (${beforeScore} -> ${afterScore})`);
    return true;
  }

  manifest.warnings.push(`Mojibake marker remains in ${safeRelative(root, file)} (${beforeScore}); skipped auto-repair.`);
  log(`  - warning: mojibake marker remains in ${safeRelative(root, file)} (${beforeScore}); skipped auto-repair`);
  return false;
}

function runCommand(label, command) {
  log("");
  log(`[OddEngine] Running ${label}...`);
  const result = spawnSync("cmd.exe", ["/c", command], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  if (stdout.trim()) log(stdout.trimEnd());
  if (stderr.trim()) log(stderr.trimEnd());

  manifest.commands.push({
    label,
    command,
    exitCode: result.status ?? 1,
  });

  return result.status ?? 1;
}

log(`[OddEngine] ${PASS}`);
log(`[OddEngine] Root: ${root}`);
log(`[OddEngine] Checkpoint: ${safeRelative(root, checkpointDir)}`);

const duplicateTree = path.join(root, "ui", "src", "components", "ui", "src");
if (exists(duplicateTree)) {
  log("");
  log("[OddEngine] Quarantining duplicate nested source tree...");
  safeQuarantinePath(duplicateTree, "duplicate nested source tree");
} else {
  log("[OddEngine] Duplicate nested source tree not present.");
}

const uiSrc = path.join(root, "ui", "src");
const patchDebris = walk(uiSrc).filter((file) => {
  const rel = safeRelative(root, file);
  if (isInside(file, checkpointDir)) return false;
  return /(^|[\\/]).*PATCH.*\.(ts|tsx)$/i.test(file);
});

if (patchDebris.length) {
  log("");
  log(`[OddEngine] Quarantining patch debris under ui/src (${patchDebris.length})...`);
  for (const file of patchDebris) safeQuarantinePath(file, "patch debris under ui/src");
} else {
  log("[OddEngine] No PATCH debris under ui/src.");
}

const repairTargets = [
  path.join(root, "ui", "src", "styles.css"),
  path.join(root, "ui", "src", "App.tsx"),
  path.join(root, "ui", "src", "panels", "Home.tsx"),
  path.join(root, "ui", "src", "panels", "Trading.tsx"),
  path.join(root, "ui", "src", "components", "ActivityRail.tsx"),
  path.join(root, "ui", "src", "panels", "Homie.tsx"),
].filter(exists);

log("");
log("[OddEngine] Checking key UI files for mojibake markers...");
for (const file of repairTargets) repairFile(file);

const auditCode = runCommand("npm run audit:runtime", "npm run audit:runtime");
const buildCode = runCommand("npm run build:web", "npm run build:web");

const finalWarnings = [];
const stylesPath = path.join(root, "ui", "src", "styles.css");
if (exists(stylesPath)) {
  const styles = fs.readFileSync(stylesPath, "utf8");
  const score = mojibakeScore(styles);
  if (score > 0) finalWarnings.push(`ui/src/styles.css still contains possible mojibake markers (score ${score}).`);
}
if (exists(duplicateTree)) finalWarnings.push("Duplicate tree still exists after quarantine attempt.");
const remainingPatchDebris = walk(uiSrc).filter((file) => /(^|[\\/]).*PATCH.*\.(ts|tsx)$/i.test(file));
if (remainingPatchDebris.length) finalWarnings.push(`Patch debris under ui/src remains (${remainingPatchDebris.length}).`);

if (finalWarnings.length) {
  log("");
  log("[OddEngine] Remaining warnings:");
  for (const warning of finalWarnings) {
    manifest.warnings.push(warning);
    log(`  - ${warning}`);
  }
}

manifest.finishedAt = new Date().toISOString();
manifest.auditPassed = auditCode === 0;
manifest.buildPassed = buildCode === 0;
manifest.cleanEnoughForCheckpoint = auditCode === 0 && buildCode === 0 && finalWarnings.length === 0;

fs.writeFileSync(path.join(checkpointDir, "RUNTIME_AUDIT_REPORT.txt"), reportLines.join("\n") + "\n", "utf8");
fs.writeFileSync(path.join(checkpointDir, "checkpoint-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

log("");
log(`[OddEngine] Report written: ${safeRelative(root, path.join(checkpointDir, "RUNTIME_AUDIT_REPORT.txt"))}`);
log(`[OddEngine] Manifest written: ${safeRelative(root, path.join(checkpointDir, "checkpoint-manifest.json"))}`);

if (manifest.cleanEnoughForCheckpoint) {
  log("[OddEngine] Cleanup, audit, and build passed cleanly.");
  process.exit(0);
}

log("[OddEngine] Blocking issue(s) remain. Do not tag yet.");
process.exit(1);
