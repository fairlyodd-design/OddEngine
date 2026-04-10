import express from "express";
import fs from "node:fs";
import path from "node:path";

const app = express();
const PORT = Number(process.env.PORT || 8787);
const API_PREFIX = process.env.API_PREFIX || "/api";
const BEARER_TOKEN = process.env.BEARER_TOKEN || "";
const DATA_DIR = path.resolve(process.cwd(), "backend_scaffold_data");

fs.mkdirSync(DATA_DIR, { recursive: true });
app.use(express.json({ limit: "5mb" }));

function auth(req, res, next) {
  if (!BEARER_TOKEN) return next();
  const header = req.headers.authorization || "";
  if (header === `Bearer ${BEARER_TOKEN}`) return next();
  return res.status(401).json({ ok: false, message: "Unauthorized" });
}

function snapshotFile(householdId) {
  return path.join(DATA_DIR, `${householdId}.json`);
}

app.get(`${API_PREFIX}/health`, (_req, res) => {
  res.json({ ok: true, status: "healthy", service: "oddengine-budget-sync", now: new Date().toISOString() });
});

app.get(`${API_PREFIX}/households/:id/snapshot`, auth, (req, res) => {
  const file = snapshotFile(req.params.id);
  if (!fs.existsSync(file)) {
    return res.json({
      household: { name: "Empty Household", currency: "USD", members: [] },
      accounts: [],
      transactions: [],
      goals: [],
      recurring: [],
      budgetLines: [],
      connections: [],
      netWorthHistory: [],
      annualPlan: [],
      syncBridge: {}
    });
  }
  return res.json(JSON.parse(fs.readFileSync(file, "utf8")));
});

app.post(`${API_PREFIX}/households/:id/snapshot`, auth, (req, res) => {
  const file = snapshotFile(req.params.id);
  fs.writeFileSync(file, JSON.stringify(req.body, null, 2));
  res.json({ ok: true, saved: true, householdId: req.params.id, updatedAt: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`OddEngine snapshot server listening on http://localhost:${PORT}${API_PREFIX}`);
});
