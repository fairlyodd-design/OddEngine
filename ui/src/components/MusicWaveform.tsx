import React from 'react';

export default function MusicWaveform({ values, compact = false }: { values?: number[]; compact?: boolean }) {
  const bars = Array.isArray(values) && values.length ? values : [18, 24, 32, 26, 40, 52, 38, 22, 30, 46, 36, 20];
  return (
    <div className="musicWaveform" style={{ minHeight: compact ? 48 : 74 }}>
      {bars.map((value, idx) => (
        <div
          key={`${idx}-${value}`}
          className="musicWaveformBar"
          style={{ height: Math.max(compact ? 10 : 14, Number(value) || 12) }}
        />
      ))}
    </div>
  );
}
