import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = Number(process.env.PORT || 8900);
const OUTPUT_ROOT = process.env.OUTPUT_ROOT || path.resolve(process.cwd(), 'publishing_runs');
const runs = new Map();

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildPublicFileUrl(req, absolutePath) {
  const rel = path.relative(OUTPUT_ROOT, absolutePath).split(path.sep).join('/');
  return `${req.protocol}://${req.get('host')}/files/${rel}`;
}

function serializeRun(req, run) {
  return {
    ok: true,
    runId: run.runId,
    connector: run.connector,
    status: run.status,
    detail: run.detail,
    payloadPath: run.payloadPath,
    receiptPath: run.receiptPath || '',
    receivedAt: run.receivedAt,
    updatedAt: run.updatedAt,
    receipt: run.receiptPath ? {
      path: run.receiptPath,
      label: `${run.connector} handoff receipt`,
      kind: 'receipt',
      url: buildPublicFileUrl(req, run.receiptPath),
    } : null,
  };
}

async function writeRunFiles(run, payload) {
  await ensureDir(run.runDir);
  await fs.writeFile(run.payloadPath, JSON.stringify(payload, null, 2), 'utf8');
  const receipt = {
    ok: true,
    runId: run.runId,
    connector: run.connector,
    status: run.status,
    detail: run.detail,
    payloadPath: run.payloadPath,
    receiptPath: run.receiptPath,
    receivedAt: run.receivedAt,
    updatedAt: run.updatedAt,
  };
  await fs.writeFile(run.receiptPath, JSON.stringify(receipt, null, 2), 'utf8');
}

function advanceRunState(run) {
  const now = Date.now();
  const age = now - run.createdAt;
  if (age >= 6000) {
    run.status = 'completed';
    run.detail = `${run.connector} handoff receipt ready for local connector import`;
  } else if (age >= 3000) {
    run.status = 'processing';
    run.detail = `Preparing ${run.connector} handoff receipt and local import record`;
  } else {
    run.status = 'accepted';
    run.detail = `Stored ${run.connector} handoff payload for local runner consumption`;
  }
  run.updatedAt = new Date(now).toISOString();
}

app.get('/health', async (_req, res) => {
  await ensureDir(OUTPUT_ROOT);
  res.json({ ok: true, status: 'ready', service: 'oddengine-publishing-connector', outputRoot: OUTPUT_ROOT });
});

app.use('/files', express.static(OUTPUT_ROOT));

app.post('/publish/:connector', async (req, res) => {
  const connector = String(req.params.connector || '').trim();
  if (!['youtube', 'gumroad'].includes(connector)) {
    return res.status(404).json({ ok: false, error: 'Unknown connector' });
  }
  const runId = `${connector}-${uid()}`;
  const runDir = path.join(OUTPUT_ROOT, runId);
  const payloadPath = path.join(runDir, `${connector}-payload.json`);
  const receiptPath = path.join(runDir, `${connector}-handoff-receipt.json`);
  const nowIso = new Date().toISOString();
  const payload = req.body || {};
  const run = {
    runId,
    connector,
    status: 'accepted',
    detail: `Stored ${connector} handoff payload for local runner consumption`,
    runDir,
    payloadPath,
    receiptPath,
    receivedAt: nowIso,
    createdAt: Date.now(),
    updatedAt: nowIso,
  };
  runs.set(runId, run);
  await writeRunFiles(run, payload);
  return res.json(serializeRun(req, run));
});

app.get('/publish/runs/:runId', async (req, res) => {
  const run = runs.get(String(req.params.runId || '').trim());
  if (!run) {
    return res.status(404).json({ ok: false, error: 'Unknown run' });
  }
  advanceRunState(run);
  const payload = await fs.readFile(run.payloadPath, 'utf8').then((x) => JSON.parse(x)).catch(() => ({}));
  await writeRunFiles(run, payload);
  return res.json(serializeRun(req, run));
});

app.get('/publish/runs/:runId/receipt', async (req, res) => {
  const run = runs.get(String(req.params.runId || '').trim());
  if (!run) {
    return res.status(404).json({ ok: false, error: 'Unknown run' });
  }
  advanceRunState(run);
  const payload = await fs.readFile(run.payloadPath, 'utf8').then((x) => JSON.parse(x)).catch(() => ({}));
  await writeRunFiles(run, payload);
  return res.json({
    ...serializeRun(req, run),
    detail: run.status === 'completed' ? `${run.connector} receipt imported into Studio` : run.detail,
  });
});

app.listen(PORT, () => {
  console.log(`[publishing-connector] listening on http://127.0.0.1:${PORT}`);
  console.log(`[publishing-connector] output root: ${OUTPUT_ROOT}`);
});
