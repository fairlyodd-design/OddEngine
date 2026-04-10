
import express from "express";
const app = express();

app.get("/analytics/health", (_req,res)=>{
  res.json({ ok:true, status:"ready", detail:"analytics starter online" });
});

app.get("/analytics/revenue", (_req,res)=>{
  const now = new Date().toISOString();
  res.json({
    records: [
      { id:"yt-1", provider:"youtube", title:"Video A", views:1200, clicks:80, conversions:12, revenue:34.25, currency:"USD", timestamp:now },
      { id:"gm-1", provider:"gumroad", title:"Pack B", views:300, clicks:45, conversions:9, revenue:79.00, currency:"USD", timestamp:now }
    ]
  });
});

app.listen(8899, ()=>console.log("Publisher analytics starter on http://127.0.0.1:8899"));
