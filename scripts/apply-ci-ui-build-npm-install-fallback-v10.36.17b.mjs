import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const target = path.join(root, '.github', 'workflows', 'ci-ui-build.yml');
const payload = path.join(__dirname, 'ci-ui-build.v10.36.17b.yml.txt');
const report = path.join(root, 'v10.36.17b-ci-ui-build-npm-install-fallback-report.json');
const notes = [];
function ok(msg){ notes.push(`OK: ${msg}`); console.log(`OK: ${msg}`); }
function fail(msg){ console.error(`\nERROR: ${msg}\n`); try{ fs.writeFileSync(report, JSON.stringify({ ok:false, error: msg, notes }, null, 2)); }catch{} process.exit(1); }

if (!fs.existsSync(payload)) fail(`Missing workflow payload: ${payload}`);
if (!fs.existsSync(path.dirname(target))) fs.mkdirSync(path.dirname(target), { recursive: true });
if (fs.existsSync(target)) {
  const backup = `${target}.bak_v10.36.17b_${Date.now()}`;
  fs.copyFileSync(target, backup);
  ok(`backup created: ${path.relative(root, backup)}`);
}
const content = fs.readFileSync(payload, 'utf8');
fs.writeFileSync(target, content, 'utf8');
ok('rewrote .github/workflows/ci-ui-build.yml with npm install fallback and Node 24 actions');
const written = fs.readFileSync(target, 'utf8');
const required = [
  "uses: actions/checkout@v5",
  "uses: actions/setup-node@v6",
  "node-version: '24'",
  "FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'",
  "npm install",
  "npm run typecheck",
  "npm run build",
  "Failure breadcrumbs",
];
const missing = required.filter((x) => !written.includes(x));
if (missing.length) fail(`Hard validation failed. Missing: ${missing.join(', ')}`);
if (written.includes('npm ci --include=dev')) fail('Hard validation failed: old npm ci command is still present.');
fs.writeFileSync(report, JSON.stringify({ ok:true, notes, touched:[path.relative(root,target)] }, null, 2));
console.log('\n✅ v10.36.17b_CIUIBuildNpmInstallFallbackPass applied.');
console.log(`Report written to ${path.basename(report)}`);
