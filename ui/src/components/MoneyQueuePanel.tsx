
import React, { useEffect, useMemo, useState } from "react";
import { fetchRevenue } from "../lib/publisherAnalyticsBridge";
import { analyzeRevenue } from "../lib/moneyAutopilotAI";
import { MoneyQueueItem, loadMoneyQueue, saveMoneyQueue, buildQueueFromSuggestions, updateQueueStatus } from "../lib/moneyQueue";

export default function MoneyQueuePanel() {
  const [items, setItems] = useState<MoneyQueueItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const existing = loadMoneyQueue();
    setItems(existing);
  }, []);

  useEffect(() => {
    saveMoneyQueue(items);
  }, [items]);

  async function generateQueue() {
    setLoading(true);
    try {
      const data = await fetchRevenue();
      const suggestions = analyzeRevenue(data);
      const queue = buildQueueFromSuggestions(suggestions);
      setItems(queue);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }

  function setStatus(id: string, status: any) {
    setItems(prev => updateQueueStatus(prev, id, status));
  }

  const counts = useMemo(() => {
    return items.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [items]);

  return (
    <div style={{ padding: 12, color: "#eaf5ff" }}>
      <h3>💸 Money Autopilot Queue</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={generateQueue}>Generate Queue</button>
        <Stat label="Queued" value={counts.queued || 0} />
        <Stat label="Executing" value={counts.executing || 0} />
        <Stat label="Completed" value={counts.completed || 0} />
        <Stat label="Skipped" value={counts.skipped || 0} />
        <Stat label="Snoozed" value={counts.snoozed || 0} />
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        {loading && <div>Building queue...</div>}
        {items.length ? items.map(item => (
          <div key={item.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div><b>{item.actionType.toUpperCase()}</b> • Score {item.score}</div>
                <div style={{ opacity: .88 }}>{item.title}</div>
              </div>
              <div style={{ opacity: .75 }}>{item.status}</div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <button onClick={() => setStatus(item.id, "executing")}>Execute</button>
              <button onClick={() => setStatus(item.id, "completed")}>Complete</button>
              <button onClick={() => setStatus(item.id, "skipped")}>Skip</button>
              <button onClick={() => setStatus(item.id, "snoozed")}>Snooze</button>
            </div>
          </div>
        )) : !loading && <div style={{ opacity: .7 }}>No queue yet. Generate one.</div>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div style={{
      border: "1px solid rgba(120,180,255,.18)",
      borderRadius: 12,
      padding: "6px 10px",
      background: "rgba(10,16,28,.82)"
    }}>
      <div style={{ opacity: .7, fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 800 }}>{value}</div>
    </div>
  );
}

const card: React.CSSProperties = {
  border: "1px solid rgba(120,180,255,.18)",
  borderRadius: 12,
  padding: 10,
  background: "rgba(10,16,28,.82)"
};
