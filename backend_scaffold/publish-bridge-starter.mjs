
import express from "express";

const app = express();
app.use(express.json());

app.get("/publish/health", (_req, res) => {
  res.json({ status: "ready", detail: "publish bridge starter online" });
});

app.post("/publish/submit", (req, res) => {
  const { title, target } = req.body || {};
  res.json({
    status: "submitted",
    url: `https://${target}.example.com/${encodeURIComponent(title || "artifact")}`,
    detail: "starter publish bridge accepted job"
  });
});

app.listen(8899, () => {
  console.log("Publish bridge starter listening on http://127.0.0.1:8899");
});
