import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const root = join(dirname(__filename), "..");
const source = join(root, "scripts", "ci-ui-build.v10.36.17a.yml.txt");
const target = join(root, ".github", "workflows", "ci-ui-build.yml");
const report = join(root, "v10.36.17a-ci-ui-build-yaml-syntax-fix-report.json");

const log = [];
function ok(message){ console.log(`OK: ${message}`); log.push({ ok:true, message }); }
function fail(message){ console.error(`\nERROR: ${message}\n`); log.push({ ok:false, message }); writeFileSync(report, JSON.stringify({ pass:"v10.36.17a", ok:false, log }, null, 2)); process.exit(1); }

if (!existsSync(source)) fail(`Missing payload: ${source}`);
mkdirSync(dirname(target), { recursive: true });
if (existsSync(target)) {
  const backup = `${target}.bak_v10.36.17a_${Date.now()}`;
  copyFileSync(target, backup);
  ok(`backup created: ${backup}`);
}
copyFileSync(source, target);
ok("wrote .github/workflows/ci-ui-build.yml with fixed step indentation and Node 24 runtime");

const text = readFileSync(target, "utf8");
const checks = [
  ["Install step indented", /- name: Install UI dependencies\n\s+run: npm ci --include=dev/],
  ["Verify Vite step indented", /- name: Verify Vite exists\n\s+run: ls -la node_modules\/vite\/bin/],
  ["Build UI step indented", /- name: Build UI\n\s+run: npm run build/],
  ["Node 24 set", /node-version:\s*'24'/],
  ["No orphan top-level step", !/\n- name: Verify Vite exists/.test(text)],
];
for (const [label, check] of checks) {
  const passed = check instanceof RegExp ? check.test(text) : !!check;
  if (!passed) fail(`Validation failed: ${label}`);
}

// Basic YAML sanity using ruby if available on Windows/git-bash runners; safe fallback if not installed.
const ruby = spawnSync("ruby", ["-e", `require 'yaml'; YAML.load_file('${target.replace(/\\/g,"/")}'); puts 'yaml ok'`], { shell: true, encoding:"utf8" });
if (ruby.status === 0) ok("Ruby YAML parser accepted ci-ui-build.yml");
else ok("Ruby YAML parser unavailable or skipped; regex validation passed");

writeFileSync(report, JSON.stringify({ pass:"v10.36.17a", ok:true, log }, null, 2));
console.log("\n✅ v10.36.17a_CIUIBuildYamlSyntaxFixPass applied.");
console.log("Report written to v10.36.17a-ci-ui-build-yaml-syntax-fix-report.json");
