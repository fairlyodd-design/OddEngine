import React, { useState } from 'react';

export default function GodModeCommandDeck({ onRun, onQuick }: { onRun: (command: string) => void; onQuick: (command: string) => void; }) {
  const [command, setCommand] = useState('');
  const quick = [
    'Homie open Trading',
    'Homie open Poker',
    'Open trading chart',
    'Put Budget left and Homie right',
    'Load Night Desk',
    'Focus Homie',
  ];
  return (
    <div className="godModeCommandDeck">
      <div className="godModeCommandDeckRow">
        <input className="input" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="Homie open Trading full screen • save this as Night Desk • put Budget left and Homie right" />
        <button className="btn" onClick={() => { onRun(command); setCommand(''); }}>Run</button>
      </div>
      <div className="godModeQuickRow">
        {quick.map((item) => <button key={item} className="tabBtn" onClick={() => onQuick(item)}>{item}</button>)}
      </div>
    </div>
  );
}
