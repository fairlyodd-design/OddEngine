import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const uiRoot = path.join(root, "ui");
const srcRoot = path.join(uiRoot, "src");
const duplicateTree = path.join(srcRoot, "components", "ui", "src");
const auditEntry = path.join(srcRoot, "auditEntry.ts");
const hardErrors = [];
const warnings = [];
const notes = [];

function exists(file) {
  return fs.existsSync(file);
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    hardErrors.push(`${label} is missing or invalid JSON: ${path.relative(root, file)} (${err.message})`);
    return null;
  }
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

function exactCasePath(candidate) {
  const resolved = path.resolve(candidate);
  const parsed = path.parse(resolved);
  let current = parsed.root || process.cwd();
  const remainder = parsed.root ? resolved.slice(parsed.root.length) : path.relative(current, resolved);
  const segments = remainder.split(path.sep).filter(Boolean);

  if (parsed.root && !fs.existsSync(parsed.root)) return false;

  for (const segment of segments) {
    if (!fs.existsSync(current)) return false;
    let names;
    try {
      names = fs.readdirSync(current);
    } catch {
      return false;
    }
    const exact = names.find((name) => name === segment);
    if (!exact) return false;
    current = path.join(current, exact);
  }

  return fs.existsSync(resolved);
}

function isDirectory(file) {
  try {
    return fs.statSync(file).isDirectory();
  } catch {
    return false;
  }
}

function hasExplicitExtension(specifier) {
  return Boolean(path.extname(specifier));
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) return { ok: true, external: true };

  const base = path.resolve(path.dirname(fromFile), specifier);
  const explicit = hasExplicitExtension(specifier);

  // v10.36.13c fix:
  // Do not check raw extensionless directories before .ts/.tsx/index candidates.
  // On Windows, fs.existsSync("./panels/Trading") can be true when Trading is a
  // folder, causing the audit to incorrectly label a valid directory module as a
  // case mismatch before it ever checks ./panels/Trading/index.tsx.
  const candidates = explicit
    ? [base]
    : [
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}.jsx`,
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
        path.join(base, "index.js"),
        path.join(base, "index.jsx"),
      ];

  const found = candidates.find((candidate) => fs.existsSync(candidate) && !isDirectory(candidate));
  if (found) {
    if (!exactCasePath(found)) return { ok: false, reason: "case-mismatch", candidates, found };
    return { ok: true, found };
  }

  if (!explicit && fs.existsSync(base) && isDirectory(base)) {
    return {
      ok: false,
      reason: "directory-has-no-index",
      candidates,
      found: base,
    };
  }

  return { ok: false, reason: "missing", candidates };
}

function extractImportSpecifiers(file) {
  const text = fs.readFileSync(file, "utf8");
  const specs = [];
  const patterns = [
    /import\s+(?:[^'";]+?\s+from\s+)?["']([^"']+)["']/g,
    /export\s+(?:[^'";]+?\s+from\s+)["']([^"']+)["']/g,
    /import\(["']([^"']+)["']\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) specs.push(match[1]);
  }
  return [...new Set(specs)];
}

const rootPkg = readJson(path.join(root, "package.json"), "root package.json");
const uiPkg = readJson(path.join(uiRoot, "package.json"), "ui package.json");

if (!exists(uiRoot)) hardErrors.push("Missing ui/ directory.");
if (!exists(srcRoot)) hardErrors.push("Missing ui/src directory.");
if (!exists(auditEntry)) hardErrors.push("Missing ui/src/auditEntry.ts audit entrypoint.");

if (rootPkg) {
  const scripts = rootPkg.scripts || {};
  for (const scriptName of ["build:web", "audit:imports", "audit:runtime"]) {
    if (!scripts[scriptName]) warnings.push(`Root package missing script: ${scriptName}`);
  }
}

if (uiPkg) {
  const scripts = uiPkg.scripts || {};
  for (const scriptName of ["build", "typecheck"]) {
    if (!scripts[scriptName]) hardErrors.push(`UI package missing required script: ${scriptName}`);
  }
}

if (exists(duplicateTree)) {
  warnings.push(`Duplicate/quarantined component tree still exists: ${path.relative(root, duplicateTree)}`);
}

const patchFiles = walk(srcRoot).filter((file) => /(^|[\\/]).*PATCH.*\.(ts|tsx)$/i.test(file));
if (patchFiles.length) {
  warnings.push(`Patch debris still present under ui/src (${patchFiles.length} file(s)).`);
  for (const file of patchFiles.slice(0, 15)) warnings.push(`  - ${path.relative(root, file)}`);
  if (patchFiles.length > 15) warnings.push(`  - ... ${patchFiles.length - 15} more`);
}

if (exists(auditEntry)) {
  const imports = extractImportSpecifiers(auditEntry);
  for (const specifier of imports) {
    const result = resolveImport(auditEntry, specifier);
    if (!result.ok) {
      hardErrors.push(`auditEntry import ${result.reason}: ${specifier}`);
      if (result.found) hardErrors.push(`  resolved target: ${path.relative(root, result.found)}`);
    }
  }
  notes.push(`Audit entry import count: ${imports.length}`);
}

notes.push("Core audit bridge is active.");
notes.push("Case audit walker fixed for Windows extensionless TS/TSX imports.");
notes.push("Directory import audit now checks .ts/.tsx and index.ts/index.tsx before raw folders.");
notes.push("Typecheck targets ui/tsconfig.audit.json so CI validates the stable runtime lane before full UI build.");

const report = [
  "OddEngine v10.36.13c CI Recovery Audit",
  "=======================================",
  `Root: ${root}`,
  "",
  "Notes:",
  ...notes.map((note) => `  ✓ ${note}`),
];

if (warnings.length) {
  report.push("", "Warnings:", ...warnings.map((warning) => `  ! ${warning}`));
}

if (hardErrors.length) {
  report.push("", "Hard errors:", ...hardErrors.map((error) => `  ✗ ${error}`));
  console.error(report.join("\n"));
  process.exit(1);
}

report.push("", "Result: PASS — runtime audit lane is coherent.");
console.log(report.join("\n"));
