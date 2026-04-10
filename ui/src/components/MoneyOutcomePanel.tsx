
import React, { useEffect, useMemo, useState } from "react";
import { loadMoneyQueue } from "../lib/moneyQueue";
import { createOutcomeRecord, loadOutcomeRecords, saveOutcomeRecords, summarizeOutcomes, MoneyOutcomeRecord } from "../lib/moneyOutcomeLoop";

export default function MoneyOutcomePanel() {
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [records, setRecords] = useState<MoneyOutcomeRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [outcomeType, setOutcomeType] = useState<MoneyOutcomeRecord["outcomeType"]>("earned");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setQueueItems(loadMoneyQueue());
    setRecords(loadOutcomeRecords());
  }, []);

  useEffect(() => {
    saveOutcomeRecords(records);
  }, [records]);

  function addOutcome() {
    const item = queueItems.find(q => q.id === selectedId);
    if (!item) return;
    const record = createOutcomeRecord(
      item.id,
      item.title,
      outcomeType,
      amount ? Number(amount) : undefined,
      notes
    );
    setRecords([record, ...records]);
    setAmount("");
    setNotes("");
  }

  const summary = useMemo(() => summarizeOutcomes(records), [records]);

  return (
    <div style={{ padding: 12, color: "#eaf5ff" }}>
      <h3>📈 Money Outcome Capture & Auto Learning Loop</h3>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 12 }}>
        <Stat label="Money" value={`$${summary.money.toFixed(2)}`} />
        <Stat label="Total" value={summary.count} />
        <Stat label="Earned" value={summary.earned} />
        <Stat label="Saved" value={summary.saved} />
        <Stat label="Learned" value={summary.learned} />
        <Stat label="Failed" value={summary.failed} />
      </div>

      <div style={{ border: "1px solid rgba(120,180,255,.18)", borderRadius: 12, padding: 12, background: "rgba(10,16,28,.82)" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={field}>
            <option value="">Select queue item</option>
            {queueItems.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>

          <select value={outcomeType} onChange={e => setOutcomeType(e.target.value as any)} style={field}>
            <option value="earned">earned</option>
            <option value="saved">saved</option>
            <option value="learned">learned</option>
            <option value="failed">failed</option>
          </select>

          <input placeholder="Amount (optional)" value={amount} onChange={e => setAmount(e.target.value)} style={field} />
          <textarea placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} style={{ ...field, minHeight: 90 }} />
          <button onClick={addOutcome}>Capture Outcome</button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        {records.length ? records.map(r => (
          <div key={r.id} style={card}>
            <div><b>{r.outcomeType.toUpperCase()}</b> • {r.title}</div>
            <div style={{ opacity: .82 }}>
              {typeof r.amount === "number" ? `$${r.amount.toFixed(2)} • ` : ""}
              {r.notes || "No notes"}
            </div>
          </div>
        )) : <div style={{ opacity: .7 }}>No outcome records yet.</div>}
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

const field: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  background: "rgba(11,18,31,.95)",
  color: "#eef7ff",
  border: "1px solid rgba(120,180,255,.18)",
};

const card: React.CSSProperties = {
  border: "1px solid rgba(120,180,255,.18)",
  borderRadius: 12,
  padding: 10,
  background: "rgba(10,16,28,.82)"
};
