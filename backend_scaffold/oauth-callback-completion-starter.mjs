
import express from "express";

const app = express();
app.use(express.json());

app.get("/oauth/callback/health", (_req, res) => {
  res.json({ ok: true, status: "ready", detail: "oauth callback completion starter online" });
});

app.post("/oauth/callback/complete", (req, res) => {
  const { provider, code, state } = req.body || {};
  if (!provider || !code) {
    return res.status(400).json({ status: "missing provider or code" });
  }
  res.json({
    ok: true,
    status: "completed",
    provider,
    detail: `starter callback completion accepted code=${String(code).slice(0, 6)} state=${String(state || "").slice(0, 6)}`,
  });
});

app.listen(8899, () => {
  console.log("OAuth callback completion starter listening on http://127.0.0.1:8899");
});
