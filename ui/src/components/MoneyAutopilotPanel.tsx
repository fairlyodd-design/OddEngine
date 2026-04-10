
import React, { useEffect, useState } from "react";
import { fetchRevenue } from "../lib/publisherAnalyticsBridge";
import { analyzeRevenue, MoneySuggestion } from "../lib/moneyAutopilotAI";

export default function MoneyAutopilotPanel() {
  const [suggestions, setSuggestions] = useState<MoneySuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  async function runAnalysis() {
    setLoading(true);
    try {
      const data = await fetchRevenue();
      const result = analyzeRevenue(data);
      setSuggestions(result);
    } catch {
      setSuggestions([]);
    }
    setLoading(false);
  }

  useEffect(()=>{ runAnalysis(); },[]);

  return (
    <div style={{padding:12, color:"#eaf5ff"}}>
      <h3>🧠 Money Autopilot AI</h3>
      <button onClick={runAnalysis}>Recalculate</button>

      <div style={{marginTop:12, display:"grid", gap:8}}>
        {loading && <div>Analyzing...</div>}
        {suggestions.length ? suggestions.map(s=>(
          <div key={s.id} style={card}>
            <div><b>{s.type.toUpperCase()}</b> • Score {s.score}</div>
            <div style={{opacity:.85}}>{s.message}</div>
          </div>
        )) : !loading && <div style={{opacity:.7}}>No suggestions yet.</div>}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  border:"1px solid rgba(120,180,255,.18)",
  borderRadius:12,
  padding:10,
  background:"rgba(10,16,28,.82)"
};
