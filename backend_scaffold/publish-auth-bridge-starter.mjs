
import express from "express";

const app = express();
app.use(express.json());

app.get("/publish/auth/health", (_req, res) => {
  res.json({ ok: true, status: "ready", detail: "auth bridge starter online" });
});

app.post("/publish/auth/start", (req, res) => {
  const { target } = req.body || {};
  res.json({
    ok: true,
    status: "started",
    url: `http://127.0.0.1:8899/mock-auth/${target}`,
    detail: `starter auth flow for ${target}`,
  });
});

app.listen(8899, () => {
  console.log("Publish auth bridge starter listening on http://127.0.0.1:8899");
});
