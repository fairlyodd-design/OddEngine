
import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());

const encryptedStore = new Map();
const MASTER_KEY = "fairlyodd-master-key-starter";

function encryptObject(obj) {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash("sha256").update(MASTER_KEY).digest();
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const input = Buffer.from(JSON.stringify(obj), "utf8");
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  return {
    iv: iv.toString("hex"),
    payload: encrypted.toString("hex"),
  };
}

app.get("/secrets/health", (_req, res) => {
  res.json({ ok: true, status: "ready", detail: "encrypted secrets vault starter online", providers: Array.from(encryptedStore.keys()) });
});

app.get("/secrets/providers", (_req, res) => {
  res.json({ providers: Array.from(encryptedStore.keys()) });
});

app.post("/secrets/store", (req, res) => {
  const { provider, secretPayload } = req.body || {};
  if (!provider) return res.status(400).json({ status: "missing provider" });
  const encrypted = encryptObject(secretPayload || {});
  encryptedStore.set(provider, encrypted);
  res.json({ ok: true, status: "stored", detail: `encrypted secret stored for ${provider}` });
});

app.listen(8899, () => {
  console.log("Encrypted secrets vault starter listening on http://127.0.0.1:8899");
});
