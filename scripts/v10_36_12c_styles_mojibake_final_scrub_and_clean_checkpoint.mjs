import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const PASS = "v10.36.12c_StylesMojibakeFinalScrubAndCleanCheckpointPass";
const root = process.cwd();
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const checkpointDir = path.join(root, "checkpoints", `${PASS}_${stamp}`);
const quarantineDir = path.join(checkpointDir, "quarantine");
fs.mkdirSync(checkpointDir, { recursive: true });
fs.mkdirSync(quarantineDir, { recursive: true });

const reportLines = [];
function log(line = "") {
  console.log(line);
  reportLines.push(line);
}
function rel(p) {
  return path.relative(root, p).replaceAll(path.sep, "/");
}
function writeReport(extra = {}) {
  const reportPath = path.join(checkpointDir, "RUNTIME_AUDIT_REPORT.txt");
  const manifestPath = path.join(checkpointDir, "checkpoint-manifest.json");
  fs.writeFileSync(reportPath, reportLines.join("\n") + "\n", "utf8");
  fs.writeFileSync(manifestPath, JSON.stringify({
    pass: PASS,
    root,
    checkpointDir: rel(checkpointDir),
    timestamp: new Date().toISOString(),
    ...extra
  }, null, 2), "utf8");
  log(`[OddEngine] Report written: ${rel(reportPath)}`);
  log(`[OddEngine] Manifest written: ${rel(manifestPath)}`);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function run(cmd, args) {
  log("");
  log(`[OddEngine] Running ${cmd} ${args.join(" ")}...`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    shell: true,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 24
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
    reportLines.push(result.stdout.trimEnd());
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
    reportLines.push(result.stderr.trimEnd());
  }
  log(`[OddEngine] Exit code: ${result.status ?? "unknown"}`);
  return result.status ?? 1;
}

// Suspect characters commonly seen when UTF-8 text is misread as Windows-1252/Latin-1.
// Built from code points so this script contains no raw mojibake literals.
const suspectCodes = [
  0x00C2, // Â
  0x00C3, // Ã
  0x00E2, // â
  0x00F0, // ð
  0x20AC, // €
  0x2122, // ™
  0x0152, 0x0153, 0x0160, 0x0161, 0x0178, 0x017D, 0x017E,
  0xFFFD
];
const suspectSet = new Set(suspectCodes);
function mojibakeScore(text) {
  let score = 0;
  for (const ch of text) {
    if (suspectSet.has(ch.codePointAt(0))) score++;
  }
  return score;
}
function hasSuspect(text) {
  return mojibakeScore(text) > 0;
}

// Windows-1252 reverse map for the special punctuation range.
const cp1252ToUnicode = new Map([
  [0x80, 0x20AC], [0x82, 0x201A], [0x83, 0x0192], [0x84, 0x201E],
  [0x85, 0x2026], [0x86, 0x2020], [0x87, 0x2021], [0x88, 0x02C6],
  [0x89, 0x2030], [0x8A, 0x0160], [0x8B, 0x2039], [0x8C, 0x0152],
  [0x8E, 0x017D], [0x91, 0x2018], [0x92, 0x2019], [0x93, 0x201C],
  [0x94, 0x201D], [0x95, 0x2022], [0x96, 0x2013], [0x97, 0x2014],
  [0x98, 0x02DC], [0x99, 0x2122], [0x9A, 0x0161], [0x9B, 0x203A],
  [0x9C, 0x0153], [0x9E, 0x017E], [0x9F, 0x0178]
]);
const unicodeToCp1252 = new Map([...cp1252ToUnicode.entries()].map(([b, u]) => [u, b]));

function encodeAsWin1252Bytes(text) {
  const bytes = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp <= 0xFF) {
      bytes.push(cp);
    } else if (unicodeToCp1252.has(cp)) {
      bytes.push(unicodeToCp1252.get(cp));
    } else {
      // Unknown high Unicode. Preserve safety by refusing to decode this line.
      return null;
    }
  }
  return Buffer.from(bytes);
}

function tryDecodeMojibakeLine(line) {
  const beforeScore = mojibakeScore(line);
  if (!beforeScore) return { text: line, changed: false, beforeScore, afterScore: beforeScore };

  let best = line;
  let bestScore = beforeScore;

  // Repeatedly try Windows-1252 bytes -> UTF-8 text. This handles single and
  // some double-encoded mojibake without hardcoding broken string literals.
  let current = line;
  for (let i = 0; i < 3; i++) {
    const bytes = encodeAsWin1252Bytes(current);
    if (!bytes) break;
    const candidate = bytes.toString("utf8");
    const candidateScore = mojibakeScore(candidate);
    if (candidate.includes("\uFFFD")) break;
    if (candidateScore < bestScore) {
      best = candidate;
      bestScore = candidateScore;
      current = candidate;
    } else {
      break;
    }
  }

  // Conservative cleanup for invisible/nonbreaking artifacts if still present.
  best = best.replace(/\u00A0/g, " ");
  bestScore = mojibakeScore(best);

  return { text: best, changed: best !== line, beforeScore, afterScore: bestScore };
}

function scrubStyles() {
  const stylePath = path.join(root, "ui", "src", "styles.css");
  if (!fs.existsSync(stylePath)) {
    log(`[OddEngine] Missing ${rel(stylePath)}; cannot scrub styles.`);
    return { before: 0, after: 0, changedLines: 0, blocking: true };
  }

  const original = fs.readFileSync(stylePath, "utf8");
  const before = mojibakeScore(original);
  log("");
  log(`[OddEngine] styles.css mojibake score before: ${before}`);

  const backupPath = path.join(checkpointDir, "styles.css.before_12c.bak");
  fs.writeFileSync(backupPath, original, "utf8");
  log(`[OddEngine] Backup written: ${rel(backupPath)}`);

  const lines = original.split(/\r?\n/);
  let changedLines = 0;
  const changed = lines.map((line, idx) => {
    if (!hasSuspect(line)) return line;
    const result = tryDecodeMojibakeLine(line);
    if (result.changed && result.afterScore < result.beforeScore) {
      changedLines++;
      log(`  - repaired line ${idx + 1}: score ${result.beforeScore} -> ${result.afterScore}`);
      return result.text;
    }
    log(`  - left line ${idx + 1}: score ${result.beforeScore}; safe auto-repair not proven`);
    return line;
  }).join("\n");

  const after = mojibakeScore(changed);
  if (changed !== original) {
    fs.writeFileSync(stylePath, changed, { encoding: "utf8" });
    log(`[OddEngine] styles.css rewritten as UTF-8. Changed lines: ${changedLines}`);
  } else {
    log("[OddEngine] styles.css unchanged; no safe repairs applied.");
  }
  log(`[OddEngine] styles.css mojibake score after: ${after}`);

  const remainingPath = path.join(checkpointDir, "styles_mojibake_remaining_lines.txt");
  const remaining = changed.split(/\r?\n/)
    .map((line, idx) => ({ idx: idx + 1, line, score: mojibakeScore(line) }))
    .filter((x) => x.score > 0)
    .map((x) => `line ${x.idx} score ${x.score}: ${x.line}`);
  fs.writeFileSync(remainingPath, remaining.join("\n") + (remaining.length ? "\n" : ""), "utf8");
  if (remaining.length) log(`[OddEngine] Remaining marker report: ${rel(remainingPath)}`);

  return { before, after, changedLines, blocking: after > 0 };
}

log(`[OddEngine] ${PASS}`);
log(`[OddEngine] Root: ${root}`);
log(`[OddEngine] Checkpoint: ${rel(checkpointDir)}`);

const uiSrc = path.join(root, "ui", "src");
const duplicateTree = path.join(uiSrc, "components", "ui", "src");
const patchFiles = walk(uiSrc).filter((file) => /(^|[\\/]).*PATCH.*\.(ts|tsx|d\.ts)$/i.test(file));

if (fs.existsSync(duplicateTree)) {
  log(`[OddEngine] Blocking: duplicate nested source tree still exists: ${rel(duplicateTree)}`);
}
if (patchFiles.length) {
  log(`[OddEngine] Blocking: patch debris still under ui/src (${patchFiles.length}).`);
  patchFiles.slice(0, 20).forEach((file) => log(`  - ${rel(file)}`));
}
if (!fs.existsSync(duplicateTree)) log("[OddEngine] Duplicate nested source tree not present.");
if (!patchFiles.length) log("[OddEngine] No PATCH debris under ui/src.");

const scrub = scrubStyles();

const auditCode = run("npm", ["run", "audit:runtime"]);
const buildCode = run("npm", ["run", "build:web"]);

const blockers = [];
if (fs.existsSync(duplicateTree)) blockers.push("duplicate nested source tree remains");
if (patchFiles.length) blockers.push("patch debris remains under ui/src");
if (scrub.after > 0) blockers.push(`ui/src/styles.css still contains possible mojibake markers (score ${scrub.after})`);
if (auditCode !== 0) blockers.push("npm run audit:runtime failed");
if (buildCode !== 0) blockers.push("npm run build:web failed");

log("");
if (blockers.length) {
  log("[OddEngine] Blocking issue(s) remain. Do not tag yet.");
  blockers.forEach((b) => log(`  - ${b}`));
  writeReport({ status: "blocked", blockers, styles: scrub });
  process.exit(1);
}

log("[OddEngine] Clean checkpoint conditions passed.");
log("[OddEngine] Suggested save commands:");
log("  git status");
log("  git add ui/src/styles.css");
log('  git commit -m "v10.36.12c clean runtime checkpoint"');
log("  git tag v10.36.12c-clean");
log("  git push origin main --tags");
writeReport({ status: "passed", blockers, styles: scrub });
process.exit(0);
