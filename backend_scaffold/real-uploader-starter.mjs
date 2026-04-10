
import express from "express";

const app = express();
app.use(express.json());

app.get("/uploader/health", (_req, res) => {
  res.json({ ok: true, status: "ready", detail: "real uploader starter online" });
});

app.post("/uploader/submit", (req, res) => {
  const { provider, title } = req.body || {};
  res.json({
    ok: true,
    status: "uploaded",
    url: `https://${provider}.example.com/live/${encodeURIComponent(title || "artifact")}`,
    detail: "starter uploader accepted artifact",
  });
});

app.listen(8899, () => {
  console.log("Real uploader starter listening on http://127.0.0.1:8899");
});
