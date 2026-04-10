import React from 'react';
import { getPanelMeta } from '../lib/brain';
import type { GodModeSectionId } from '../lib/godModeWorkspace';
import UnifiedOperatorDashboard from './UnifiedOperatorDashboard';

export default function GodModeSectionWindow({ sectionId, onNavigate, onOpenPanel }: { sectionId: GodModeSectionId; onNavigate: (id: string) => void; onOpenPanel?: (id: string) => void; }) {
  if (sectionId === 'UnifiedOperator') {
    return <UnifiedOperatorDashboard activePanelId="Brain" onNavigate={onNavigate} onOpenPanel={onOpenPanel} />;
  }

  const sectionMap: Record<Exclude<GodModeSectionId, 'UnifiedOperator'>, { title: string; panelId: string; body: string; bullets: string[] }> = {
    TradingChart: {
      title: 'Trading • Chart Focus',
      panelId: 'Trading',
      body: 'Floating focus lane for chart work. Use this window as a dedicated chart-control pane while the full Trading panel stays available elsewhere.',
      bullets: ['Jump straight into Trading for the live chart stack.', 'Use Pop out if you want a full native monitor window.', 'Keep this lane parked on screen 2 or 3 as a quick operator handle.'],
    },
    TradingChain: {
      title: 'Trading • Chain Focus',
      panelId: 'Trading',
      body: 'Floating options-chain control lane. Best for routing your chain workflow without hunting through the full desk every time.',
      bullets: ['Use Trading for the full chain and greeks workflow.', 'Keep this window near Sniper or Budget for cross-checking.', 'Pair with the Trading Desk preset for faster option sweeps.'],
    },
    TradingWatchlist: {
      title: 'Trading • Watchlist Focus',
      panelId: 'Trading',
      body: 'Floating watchlist lane for quick symbol focus, triage, and session tracking.',
      bullets: ['Good home for symbols you are stalking today.', 'Use this as a companion lane beside News and Brain.', 'Click back into Trading when you need the full desk.'],
    },
    BudgetSummary: {
      title: 'Budget • Summary',
      panelId: 'FamilyBudget',
      body: 'Floating family budget launcher and summary lane. Great for keeping the money picture visible while you work elsewhere.',
      bullets: ['Use this on a side monitor during admin sessions.', 'Pair with Calendar for bills and due dates.', 'Jump into Family Budget when you need the full tools.'],
    },
    HomiePresence: {
      title: 'Homie • Presence Lane',
      panelId: 'Homie',
      body: 'A calm anchor window for Homie operator mode. Keep this visible while you steer the OS around the other panels.',
      bullets: ['Use it as a stable command lane on monitor 2.', 'Pair with Brain for God Mode co-pilot flow.', 'Great for Night Desk and Family Ops presets.'],
    },
  };

  const item = sectionMap[sectionId];
  const meta = getPanelMeta(item.panelId);

  return (
    <div className="godSectionWindow">
      <div className="godSectionWindowHero">
        <div>
          <div className="small">{meta.icon} {meta.title}</div>
          <h3>{item.title}</h3>
        </div>
        <div className="godSectionWindowActions">
          <button className="tabBtn active" onClick={() => onNavigate(item.panelId)}>Focus {meta.title}</button>
          <button className="tabBtn" onClick={() => onOpenPanel?.(item.panelId)}>Open full window</button>
        </div>
      </div>
      <p>{item.body}</p>
      <ul className="godSectionWindowBullets">
        {item.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
      </ul>
    </div>
  );
}
