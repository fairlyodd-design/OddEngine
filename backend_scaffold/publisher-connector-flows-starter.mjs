
import express from "express";

const app = express();
app.use(express.json());

const supported = ["youtube", "gumroad", "kdp", "tiktok"];

app.get("/connectors/health", (_req, res) => {
  res.json({ ok: true, status: "ready", detail: "publisher connector flows starter online", providers: supported });
});

app.get("/connectors/providers", (_req, res) => {
  res.json({ providers: supported });
});

app.post("/connectors/start", (req, res) => {
  const { provider, artifactPath } = req.body || {};
  if (!provider) return res.status(400).json({ ok: false, status: "missing provider" });
  const flowId = `${provider}-${Date.now()}`;
  res.json({
    ok: true,
    provider,
    status: "started",
    flowId,
    detail: `starter connector flow started for ${provider}`,
    url: artifactPath || "",
  });
});

app.post("/connectors/finalize", (req, res) => {
  const { provider, flowId } = req.body || {};
  if (!provider || !flowId) return res.status(400).json({ ok: false, status: "missing provider or flowId" });
  res.json({
    ok: true,
    provider,
    status: "finalized",
    detail: `starter connector flow finalized for ${provider}`,
    url: `https://${provider}.example.com/final/${encodeURIComponent(flowId)}`,
  });
});

app.listen(8899, () => {
  console.log("Publisher connector flows starter listening on http://127.0.0.1:8899");
});
