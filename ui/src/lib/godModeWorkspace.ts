import { loadJSON, saveJSON } from './storage';
import type { FreeformPaneRect } from './layoutMemory';

export type GodModePaneKind = 'panel' | 'section';
export type GodModeSectionId = 'TradingChart' | 'TradingChain' | 'TradingWatchlist' | 'BudgetSummary' | 'HomiePresence' | 'UnifiedOperator';

export type GodModePane = {
  id: string;
  title: string;
  kind: GodModePaneKind;
  targetId: string;
  rect: FreeformPaneRect;
};

export type GodModePreset = {
  id: string;
  name: string;
  panes: GodModePane[];
};

const PANE_STORE_PREFIX = 'oddengine:godmode:panes:';
const PRESET_STORE_PREFIX = 'oddengine:godmode:presets:';

export function getWorkspaceScreenSignature() {
  if (typeof window === 'undefined') return 'unknown';
  const screenObj = window.screen;
  const vw = window.innerWidth || screenObj?.width || 1600;
  const vh = window.innerHeight || screenObj?.height || 1000;
  const sw = screenObj?.width || vw;
  const sh = screenObj?.height || vh;
  const dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;
  return `${sw}x${sh}@${dpr}::${vw}x${vh}`;
}

export function paneStoreKey(signature = getWorkspaceScreenSignature()) {
  return `${PANE_STORE_PREFIX}${signature}`;
}

export function presetStoreKey(signature = getWorkspaceScreenSignature()) {
  return `${PRESET_STORE_PREFIX}${signature}`;
}

export function loadGodModePanes(signature = getWorkspaceScreenSignature()) {
  return loadJSON<GodModePane[]>(paneStoreKey(signature), []);
}

export function saveGodModePanes(panes: GodModePane[], signature = getWorkspaceScreenSignature()) {
  saveJSON(paneStoreKey(signature), panes);
}

export function loadGodModePresets(signature = getWorkspaceScreenSignature()) {
  return loadJSON<GodModePreset[]>(presetStoreKey(signature), []);
}

export function saveGodModePresets(presets: GodModePreset[], signature = getWorkspaceScreenSignature()) {
  saveJSON(presetStoreKey(signature), presets);
}

export function makeGodModePane(input: Partial<GodModePane> & Pick<GodModePane, 'title' | 'kind' | 'targetId' | 'rect'>): GodModePane {
  return {
    id: input.id || `${input.kind}-${input.targetId}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title,
    kind: input.kind,
    targetId: input.targetId,
    rect: input.rect,
  };
}

export function defaultPaneRect(index = 0, width = 760, height = 520): FreeformPaneRect {
  const x = 120 + ((index * 46) % 320);
  const y = 90 + ((index * 34) % 220);
  return { x, y, w: width, h: height, z: 30 + index };
}

export function builtInGodModePresets(): GodModePreset[] {
  return [
    {
      id: 'trading-desk',
      name: 'Trading Desk',
      panes: [
        makeGodModePane({ title: 'Trading', kind: 'panel', targetId: 'Trading', rect: { x: 110, y: 74, w: 1040, h: 760, z: 40 } }),
        makeGodModePane({ title: 'Options Sniper', kind: 'panel', targetId: 'OptionsSniperTerminal', rect: { x: 1180, y: 74, w: 560, h: 430, z: 41 } }),
        makeGodModePane({ title: 'Trading • Chart Focus', kind: 'section', targetId: 'TradingChart', rect: { x: 1180, y: 526, w: 560, h: 308, z: 42 } }),
      ],
    },
    {
      id: 'operator-dashboard',
      name: 'Operator Dashboard',
      panes: [
        makeGodModePane({ title: 'God Mode • Unified Operator', kind: 'section', targetId: 'UnifiedOperator', rect: { x: 74, y: 68, w: 1060, h: 820, z: 40 } }),
        makeGodModePane({ title: 'Homie', kind: 'panel', targetId: 'Homie', rect: { x: 1160, y: 68, w: 560, h: 500, z: 41 } }),
        makeGodModePane({ title: 'Trading', kind: 'panel', targetId: 'Trading', rect: { x: 1160, y: 590, w: 560, h: 298, z: 42 } }),
      ],
    },
    {
      id: 'night-desk',
      name: 'Night Desk',
      panes: [
        makeGodModePane({ title: 'Budget', kind: 'panel', targetId: 'FamilyBudget', rect: { x: 84, y: 74, w: 760, h: 690, z: 40 } }),
        makeGodModePane({ title: 'Homie', kind: 'panel', targetId: 'Homie', rect: { x: 870, y: 74, w: 760, h: 690, z: 41 } }),
      ],
    },
    {
      id: 'homie-command',
      name: 'Homie Command',
      panes: [
        makeGodModePane({ title: 'Homie', kind: 'panel', targetId: 'Homie', rect: { x: 220, y: 84, w: 840, h: 720, z: 40 } }),
        makeGodModePane({ title: 'Brain', kind: 'panel', targetId: 'Brain', rect: { x: 1088, y: 84, w: 560, h: 720, z: 41 } }),
      ],
    },
    {
      id: 'operator-autopilot',
      name: 'Operator Autopilot',
      panes: [
        makeGodModePane({ title: 'God Mode • Unified Operator', kind: 'section', targetId: 'UnifiedOperator', rect: { x: 70, y: 64, w: 980, h: 820, z: 40 } }),
        makeGodModePane({ title: 'Money', kind: 'panel', targetId: 'Money', rect: { x: 1070, y: 64, w: 620, h: 390, z: 41 } }),
        makeGodModePane({ title: 'Studio', kind: 'panel', targetId: 'Books', rect: { x: 1070, y: 474, w: 620, h: 410, z: 42 } }),
      ],
    },
    {
      id: 'opportunity-radar',
      name: 'Opportunity Radar',
      panes: [
        makeGodModePane({ title: 'God Mode • Unified Operator', kind: 'section', targetId: 'UnifiedOperator', rect: { x: 64, y: 60, w: 1120, h: 828, z: 40 } }),
        makeGodModePane({ title: 'Trading', kind: 'panel', targetId: 'Trading', rect: { x: 1200, y: 60, w: 500, h: 392, z: 41 } }),
        makeGodModePane({ title: 'Money', kind: 'panel', targetId: 'Money', rect: { x: 1200, y: 470, w: 500, h: 418, z: 42 } }),
      ],
    },
  ];
}

export type GodModeParsedCommand =
  | { kind: 'open-panel'; panelId: string }
  | { kind: 'open-section'; sectionId: GodModeSectionId }
  | { kind: 'load-preset'; presetName: string }
  | { kind: 'save-preset'; presetName: string }
  | { kind: 'budget-left-homie-right' }
  | { kind: 'focus-homie' }
  | { kind: 'unknown'; raw: string };

export function parseGodModeCommand(raw: string): GodModeParsedCommand {
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return { kind: 'unknown', raw };
  if (text.includes('budget left') && text.includes('homie right')) return { kind: 'budget-left-homie-right' };
  if (text.startsWith('save this as ')) return { kind: 'save-preset', presetName: raw.trim().slice('save this as '.length).trim() || 'Custom Desk' };
  if (text.startsWith('save as ')) return { kind: 'save-preset', presetName: raw.trim().slice('save as '.length).trim() || 'Custom Desk' };
  if (text.startsWith('load ')) return { kind: 'load-preset', presetName: raw.trim().slice('load '.length).trim() };
  if (text.includes('focus homie') || text === 'homie focus') return { kind: 'focus-homie' };
  if (text.includes('chart focus') || text.includes('open trading chart')) return { kind: 'open-section', sectionId: 'TradingChart' };
  if (text.includes('open trading chain')) return { kind: 'open-section', sectionId: 'TradingChain' };
  if (text.includes('open trading watchlist')) return { kind: 'open-section', sectionId: 'TradingWatchlist' };
  if (text.includes('open budget summary')) return { kind: 'open-section', sectionId: 'BudgetSummary' };
  if (text.includes('open homie presence')) return { kind: 'open-section', sectionId: 'HomiePresence' };
  if (text.includes('open unified operator') || text.includes('operator dashboard') || text.includes('mission dashboard')) return { kind: 'open-section', sectionId: 'UnifiedOperator' };
  const openMatch = text.match(/(?:homie\s+)?open\s+(.+)/);
  if (openMatch?.[1]) {
    const target = openMatch[1].trim();
    const normalized = normalizePanelGuess(target);
    if (normalized) return { kind: 'open-panel', panelId: normalized };
  }
  return { kind: 'unknown', raw };
}

export function normalizePanelGuess(input: string) {
  const guess = String(input || '').trim().toLowerCase();
  const map: Record<string, string> = {
    trading: 'Trading',
    poker: 'Poker',
    budget: 'FamilyBudget',
    'family budget': 'FamilyBudget',
    homie: 'Homie',
    brain: 'Brain',
    calendar: 'Calendar',
    'income forge': 'PhoenixIncomeForge',
    forge: 'PhoenixIncomeForge',
    studio: 'Books',
    books: 'Books',
    money: 'Money',
    options: 'OptionsSniperTerminal',
    'options sniper': 'OptionsSniperTerminal',
    news: 'News',
  };
  return map[guess] || '';
}
