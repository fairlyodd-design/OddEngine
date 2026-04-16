import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workflowPath = path.join(root, ".github", "workflows", "ci.yml");
const payloadPath = path.join(root, "scripts", "ci.v10.36.17.yml.txt");
const reportPath = path.join(root, "v10.36.17-ci-node24-actions-report.json");
const passName = "v10.36.17_CINode24ActionsAndFailureTracePass";

function fail(message) {
  const report = { ok: false, passName, message, workflowPath, payloadPath, ts: new Date().toISOString() };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
}
function ok(message) { console.log(`OK: ${message}`); }

if (!fs.existsSync(payloadPath)) fail(`Missing workflow payload: ${payloadPath}`);
fs.mkdirSync(path.dirname(workflowPath), { recursive: true });
if (fs.existsSync(workflowPath)) {
  const backup = `${workflowPath}.bak_v10.36.17_${Date.now()}`;
  fs.copyFileSync(workflowPath, backup);
  ok(`backup created: ${backup}`);
}
const payload = fs.readFileSync(payloadPath, "utf8");
fs.writeFileSync(workflowPath, payload, "utf8");
ok("wrote .github/workflows/ci.yml with Node 24-ready actions and failure breadcrumbs");
const written = fs.readFileSync(workflowPath, "utf8");
const required = [
  "FORCE_JAVASCRIPT_ACTIONS_TO_NODE24",
  "actions/checkout@v6",
  "actions/setup-node@v6",
  "node-version: '24'",
  "actions/upload-artifact@v6",
  "Failure breadcrumbs",
  "set -euxo pipefail"
];
const missing = required.filter((needle) => !written.includes(needle));
if (missing.length) fail(`Hard validation failed. Missing: ${missing.join(", ")}`);
fs.writeFileSync(reportPath, JSON.stringify({ ok: true, passName, workflowPath, checks: required, ts: new Date().toISOString() }, null, 2));
console.log(`\n✅ ${passName} applied.`);
console.log(`Report written to ${path.basename(reportPath)}`);
