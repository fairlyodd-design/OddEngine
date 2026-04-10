
import express from "express";

const app = express();
app.use(express.json());

const providers = new Map();

app.get("/oauth/health", (_req, res) => {
  res.json({ ok: true, status: "ready", detail: "oauth vault starter online", providers: Array.from(providers.keys()) });
});

app.get("/oauth/providers", (_req, res) => {
  res.json({ providers: Array.from(providers.keys()) });
});

app.post("/oauth/store", (req, res) => {
  const { provider, tokenPayload } = req.body || {};
  if (!provider) return res.status(400).json({ status: "missing provider" });
  providers.set(provider, tokenPayload || {});
  res.json({ ok: true, status: "stored", detail: `token stored for ${provider}` });
});

app.listen(8899, () => {
  console.log("OAuth vault starter listening on http://127.0.0.1:8899");
});
