import Fastify from "fastify";
import fs from "node:fs";
import path from "node:path";

const app = Fastify({ logger: true });
const PORT = Number(process.env.PORT || 8787);
const API_PREFIX = process.env.API_PREFIX || "/api";
const BEARER_TOKEN = process.env.BEARER_TOKEN || "";
const DATA_DIR = path.resolve(process.cwd(), "backend_scaffold_data");

fs.mkdirSync(DATA_DIR, { recursive: true });

function auth(request, reply) {
  if (!BEARER_TOKEN) return true;
  const header = request.headers.authorization || "";
  if (header === `Bearer ${BEARER_TOKEN}`) return true;
  reply.code(401).send({ ok: false, message: "Unauthorized" });
  return false;
}

function snapshotFile(householdId) {
  return path.join(DATA_DIR, `${householdId}.json`);
}

app.get(`${API_PREFIX}/health`, async () => ({ ok: true, status: "healthy", service: "oddengine-budget-sync", now: new Date().toISOString() }));

app.get(`${API_PREFIX}/households/:id/snapshot`, async (request, reply) => {
  if (!auth(request, reply)) return;
  const file = snapshotFile(request.params.id);
  if (!fs.existsSync(file)) {
    return {
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
    };
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
});

app.post(`${API_PREFIX}/households/:id/snapshot`, async (request, reply) => {
  if (!auth(request, reply)) return;
  const file = snapshotFile(request.params.id);
  fs.writeFileSync(file, JSON.stringify(request.body, null, 2));
  return { ok: true, saved: true, householdId: request.params.id, updatedAt: new Date().toISOString() };
});

app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  app.log.info(`OddEngine snapshot server listening on http://localhost:${PORT}${API_PREFIX}`);
});
