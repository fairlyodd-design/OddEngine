import React, { useEffect, useMemo, useState } from "react";
import {
  PANEL_META,
  buildAssistantInsight,
  buildMissions,
  getBrainNotes,
  getGoals,
  getPanelMeta,
  normalizePanelId,
} from "../lib/brain";
import "./FairlyGodModeHUD.css";
import OddIcon from "./OddIcon";

type Tab = "Doctor" | "Panels" | "Modes" | "Receipts" | "Homie" | "Legacy" | "Safety";
type Health = "good" | "warn" | "bad";

type Receipt = {
  panelId: string;
  title: string;
  section: string;
  status: Health;
  score: number;
  reasons: string[];
  fixes: string[];
  storageKeys: string[];
  missingKeys: string[];
  lastOpened?: number;
  lastScan: number;
  backendDependency: string;
  currentRisk: string;
  bestNextAction: string;
  dataAge?: number;
  emptyStatePercent: number;
  receiptVersion: string;
};

const RECEIPTS_KEY = "oddengine:fairlygodmode:truthReceipts:v1";
const RECEIPT_HISTORY_KEY = "oddengine:fairlygodmode:receiptScanHistory:v1";
const RECEIPT_EXPORT_KEY = "oddengine:fairlygodmode:lastReceiptExport:v1";
const MODE_KEY = "oddengine:fairlygodmode:activeMode:v1";
const MODE_HISTORY_KEY = "oddengine:fairlygodmode:modeHistory:v1";
const HOMIE_COMMAND_KEY = "oddengine:fairlygodmode:homieCommand:v1";
const HOMIE_COMMAND_LOG_KEY = "oddengine:fairlygodmode:homieCommandLog:v1";
const HOMIE_PENDING_CONFIRM_KEY = "oddengine:fairlygodmode:homiePendingConfirm:v1";
const LEGACY_KEY = "oddengine:fairlygodmode:legacyOpenFirst:v1";
const LEGACY_EXPORT_KEY = "oddengine:fairlygodmode:legacyLastExport:v1";
const BACKUP_SNAPSHOT_KEY = "oddengine:fairlygodmode:backupSnapshots:v1";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // local operator state only
  }
}

function formatAge(ts?: number) {
  if (!ts) return "never";
  const delta = Math.max(0, Date.now() - ts);
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function safeDate(ts?: number) {
  if (!ts) return "never";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "unknown";
  }
}

function copyText(text: string) {
  try {
    navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function downloadTextFile(filename: string, text: string, type = "text/plain") {
  try { const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); window.setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0); return true; } catch { return false; }
}
function collectFairlyGodModeBackup() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) { const key = localStorage.key(i) || ""; if (key.startsWith("oddengine:fairlygodmode:") || key.startsWith("oddengine:godlayout:") || key.startsWith("oddengine:godpresets:") || key.startsWith("oddengine:godtemplate:") || key.startsWith("oddengine:godcard:") || key === "oddengine:pinnedPanels" || key === "oddengine:navCollapsedSections" || key === "oddengine:shellMode" || key === "oddengine:cmdMode" || key === "oddengine:homie:toneHint:v1") keys.push(key); }
  const data: Record<string, any> = {}; keys.sort().forEach((key) => { data[key] = readJSON<any>(key, localStorage.getItem(key)); }); return { app: "OddEngine", type: "FairlyGodModeBackup", version: "v10.38.456", exportedAt: Date.now(), keyCount: keys.length, data };
}
function restoreFairlyGodModeBackup(backup: any) { if (!backup || backup.type !== "FairlyGodModeBackup" || !backup.data) throw new Error("Not a FairlyGodMode backup file."); const entries = Object.entries(backup.data); entries.forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value))); return entries.length; }
function isEmptyState(value: any) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

function getStorageValue(key: string) {
  return readJSON<any>(key, null);
}

function dataAgeForPanel(_panelId: string, storageKeys: string[]) {
  let newest = 0;
  for (const key of storageKeys) {
    const value = readJSON<any>(key, null);
    if (value && typeof value === "object") {
      const candidates = [value.updatedAt, value.ts, value.lastUpdated, value.seededAt, value.createdAt].filter(
        (v) => typeof v === "number"
      );
      newest = Math.max(newest, ...candidates, 0);
    }
  }
  return newest || undefined;
}

function clearPanelLayout(panelId: string) {
  const normalized = normalizePanelId(panelId);
  const prefixes = [
    `oddengine:godlayout:${normalized}`,
    `oddengine:godpresets:${normalized}`,
    `oddengine:godtemplate:${normalized}`,
    `oddengine:godcard:${normalized}::`,
  ];
  const remove: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i) || "";
    if (prefixes.some((prefix) => key === prefix || key.startsWith(prefix))) remove.push(key);
  }
  remove.forEach((key) => localStorage.removeItem(key));
  return remove.length;
}

function setPanelLock(panelId: string, locked: boolean) {
  const normalized = normalizePanelId(panelId);
  const key = `oddengine:godlayout:${normalized}`;
  const current = readJSON<any>(key, {});
  writeJSON(key, { ...current, locked });
}

function seedStarterState(panelId: string) {
  const meta = getPanelMeta(panelId);
  const now = Date.now();
  const seeded: string[] = [];

  for (const key of meta.storageKeys || []) {
    const existing = getStorageValue(key);
    if (!isEmptyState(existing)) continue;
    if (/chat|chainSnapshot|prefs|settings/i.test(key)) continue;
    writeJSON(key, {
      seededBy: "FairlyGodMode OS Doctor",
      seededAt: now,
      panelId: meta.id,
      title: meta.title,
      note: "Starter state only. Replace this with real panel data when ready.",
      nextSteps: meta.nextSteps || [],
    });
    seeded.push(key);
  }

  return seeded;
}

function detectBackendDependency(panelId: string) {
  const id = normalizePanelId(panelId);
  if (["Homie", "HomieCloneStudio"].includes(id)) return "Homie voice/local AI bridge optional";
  if (["RenderLab", "PublisherHub", "Books"].includes(id)) return "Creative/render backend optional";
  if (["Trading", "OptionsSniperTerminal", "CoinstoreBTCUSDTFutures"].includes(id)) return "Market data/provider bridge optional";
  if (["Cameras"].includes(id)) return "Camera/vendor stream bridge optional";
  if (["News", "GroceryMeals"].includes(id)) return "External refresh/provider optional";
  return "Local panel state";
}

function scorePanel(panelId: string): Receipt {
  const meta = getPanelMeta(panelId);
  const insight = buildAssistantInsight(panelId);
  const storageKeys = meta.storageKeys || [];
  const missingKeys = storageKeys.filter((key) => isEmptyState(getStorageValue(key)));
  const layout = readJSON<any>(`oddengine:godlayout:${meta.id}`, {});
  const activePanel = readJSON<string>("oddengine:activePanel", "");
  const openedAt = readJSON<Record<string, number>>("oddengine:fairlygodmode:lastOpened:v1", {});
  const reasons: string[] = [];
  const fixes: string[] = [];

  let score = 92;

  if (insight.tone === "bad") {
    score -= 34;
    reasons.push(insight.watchouts?.[0] || "Assistant insight marks this panel as high risk.");
    fixes.push("Open the panel and resolve the visible warning first.");
  } else if (insight.tone === "warn") {
    score -= 18;
    reasons.push(insight.watchouts?.[0] || "Assistant insight marks this panel as needing review.");
    fixes.push("Review the panel and confirm the next action.");
  }

  if (missingKeys.length > 0 && storageKeys.length > 0) {
    score -= Math.min(28, missingKeys.length * 7);
    reasons.push(`${missingKeys.length} tracked storage key(s) look empty or unseeded.`);
    fixes.push("Seed starter state only if the panel is empty and safe to initialize.");
  }

  if (layout?.locked) {
    reasons.push("Layout is locked.");
    fixes.push("Unlock if you need to move cards.");
  }

  const id = normalizePanelId(panelId);
  if (["Security", "OptionsSaaS", "Money", "Trading", "Grow", "GroceryMeals"].includes(id) && missingKeys.length > 0) {
    score -= 12;
    reasons.push("This panel is important enough that thin setup data should be reviewed.");
  }

  if (id === activePanel) reasons.push("This is the currently active panel.");
  if (!reasons.length) reasons.push("No obvious issue detected from local OS signals.");
  if (!fixes.length) fixes.push(meta.nextSteps?.[0] || "Open the panel and verify its main workflow.");

  score = Math.max(5, Math.min(100, score));
  const status: Health = score < 55 ? "bad" : score < 82 ? "warn" : "good";

  return {
    panelId: meta.id,
    title: meta.title,
    section: meta.section,
    status,
    score,
    reasons,
    fixes,
    storageKeys,
    missingKeys,
    lastOpened: openedAt[meta.id],
    lastScan: Date.now(),
    backendDependency: detectBackendDependency(meta.id),
    currentRisk: status === "bad" ? "Needs attention before relying on it." : status === "warn" ? "Usable, but review the warning." : "Healthy from local signals.",
    bestNextAction: fixes[0],
    dataAge: dataAgeForPanel(meta.id, storageKeys),
    emptyStatePercent: storageKeys.length ? Math.round((missingKeys.length / storageKeys.length) * 100) : 0,
    receiptVersion: "v10.38.2b",
  };
}

function scanReceipts() {
  const receipts = PANEL_META.map((panel) => scorePanel(panel.id));
  const summary = {
    id: `scan_${Date.now()}`,
    ts: Date.now(),
    total: receipts.length,
    good: receipts.filter((r) => r.status === "good").length,
    warn: receipts.filter((r) => r.status === "warn").length,
    bad: receipts.filter((r) => r.status === "bad").length,
    topRisks: receipts
      .filter((r) => r.status !== "good")
      .slice(0, 6)
      .map((r) => ({ panelId: r.panelId, status: r.status, reason: r.reasons[0] })),
  };
  writeJSON(RECEIPTS_KEY, receipts);
  const history = readJSON<any[]>(RECEIPT_HISTORY_KEY, []);
  writeJSON(RECEIPT_HISTORY_KEY, [summary, ...history].slice(0, 30));
  return receipts;
}

const WORKSPACE_MODES = [
  {
    id: "legacy",
    name: "Family Legacy Mode",
    icon: "Legacy",
    activePanel: "Homie",
    pins: ["Home", "Homie", "FamilyBudget", "FamilyHealth", "Books", "RenderLab", "Calendar"],
    tone: "soft legacy handoff",
    shellMode: "expanded",
    commandMode: "compact",
    description: "Open-first family guidance, important notes, artifacts, and calm panels.",
  },
  {
    id: "trading",
    name: "Trading War Room",
    icon: "Trade",
    activePanel: "Trading",
    pins: ["Trading", "OptionsSniperTerminal", "CoinstoreBTCUSDTFutures", "MarketMap", "TimeMachine", "FiftyTo1K", "Money"],
    tone: "risk-first execution",
    shellMode: "compact",
    commandMode: "collapsed",
    description: "Trading, risk, market map, futures, options, and money feedback.",
  },
  {
    id: "money",
    name: "Money Recovery Mode",
    icon: "Money",
    activePanel: "Money",
    pins: ["Money", "FamilyBudget", "GroceryMeals", "OptionsSaaS", "PublisherHub", "Calendar"],
    tone: "cashflow and fastest safe win",
    shellMode: "expanded",
    commandMode: "compact",
    description: "Cashflow, offers, budget, savings, and monetization focus.",
  },
  {
    id: "studio",
    name: "Studio Creation Mode",
    icon: "Studio",
    activePanel: "Books",
    pins: ["Books", "RenderLab", "PublisherHub", "Autopilot", "Builder", "Homie", "Money"],
    tone: "create, finish, package, publish",
    shellMode: "expanded",
    commandMode: "compact",
    description: "Writers Lounge, rendering, publishing, product packaging, and Homie co-creator.",
  },
  {
    id: "morning",
    name: "Morning Command",
    icon: "AM",
    activePanel: "Home",
    pins: ["Home", "Calendar", "DailyChores", "GroceryMeals", "FamilyBudget", "HappyHealthy", "Homie"],
    tone: "daily priorities",
    shellMode: "expanded",
    commandMode: "compact",
    description: "Start the day with priorities, chores, meals, health, budget, and Homie.",
  },
  {
    id: "night",
    name: "Night Calm Mode",
    icon: "PM",
    activePanel: "DailyChores",
    pins: ["DailyChores", "Calendar", "FamilyHealth", "HappyHealthy", "Entertainment", "Homie"],
    tone: "calm shutdown",
    shellMode: "compact",
    commandMode: "collapsed",
    description: "Lower noise, family reset, light planning, and close-the-day flow.",
  },
  {
    id: "house",
    name: "Health + House Mode",
    icon: "House",
    activePanel: "FamilyHealth",
    pins: ["FamilyHealth", "HappyHealthy", "DailyChores", "GroceryMeals", "Calendar", "Cameras", "Homie"],
    tone: "care and home ops",
    shellMode: "expanded",
    commandMode: "compact",
    description: "Care briefs, wellness, chores, groceries, cameras, and calendar.",
  },
];

function applyMode(mode: typeof WORKSPACE_MODES[number], onNavigate: (id: string) => void) {
  const receipt = {
    ...mode,
    appliedAt: Date.now(),
    appliedBy: "FairlyGodMode Workspace Modes",
    safeScope: ["active panel", "pinned panels", "shell density", "command density", "Homie tone hint", "mode visual tone"],
  };

  writeJSON(MODE_KEY, receipt);
  writeJSON("oddengine:pinnedPanels", mode.pins);
  writeJSON("oddengine:shellMode", mode.shellMode);
  writeJSON("oddengine:cmdMode", mode.commandMode);
  writeJSON("oddengine:homie:toneHint:v1", mode.tone);
  writeJSON(
    "oddengine:navCollapsedSections",
    mode.id === "trading" ? { APPS: true, OS: true } : mode.id === "legacy" ? { TRADING: true, APPS: true } : {}
  );

  const history = readJSON<any[]>(MODE_HISTORY_KEY, []);
  writeJSON(MODE_HISTORY_KEY, [receipt, ...history].slice(0, 24));

  try {
    document.body.dataset.fgmMode = mode.id;
  } catch {}

  onNavigate(mode.activePanel);
  window.dispatchEvent(new CustomEvent("oddengine:fairlygodmode-mode", { detail: receipt }));
}

function defaultLegacyState() {
  return {
    updatedAt: Date.now(),
    welcomeTitle: "Open First",
    welcomeBody:
      "Start here. This page explains what FairlyOdd OS is, what matters most, and where the family can find notes, creative work, project status, and important guidance.",
    familyMessage:
      "This OS was built to help our family with home, money, health, creativity, and next steps. You do not need to understand the code. Start with the checklist, then open Homie if you need guidance.",
    whatThisIs:
      "FairlyOdd OS is a family command center. It has panels for home, budget, health, writing, publishing, trading, groceries, calendars, and Homie.",
    howToUseHomie:
      "Open Homie or the FG/GOD Homie tab and ask simple things like: what should I open first, explain this panel, show family legacy mode, or open the budget.",
    importantNotes:
      "Add important family notes here. Keep this plain and useful.",
    emergencyNotes:
      "Add emergency contacts, must-know instructions, and where to find important documents. Do not store passwords here unless you intentionally choose to.",
    projectStatus:
      [
        { title: "FairlyGodMode", status: "Active", note: "Whole-OS operator deck for health, modes, receipts, Homie commands, and legacy." },
        { title: "Homie", status: "Active", note: "Family guide and AI companion panel." },
        { title: "Creative Works", status: "In progress", note: "Books, videos, render packs, and legacy artifacts live in Writers Lounge/Render Lab." },
      ],
    checklist: [
      { id: "legacy-1", title: "Read this Open First page", note: "Understand the purpose before clicking around.", done: false },
      { id: "legacy-2", title: "Open Homie", note: "Ask Homie what to do next.", done: false },
      { id: "legacy-3", title: "Open Family Budget", note: "Review household money and priorities.", done: false },
      { id: "legacy-4", title: "Open Creative Works", note: "Look for saved books, videos, scripts, or artifacts.", done: false },
      { id: "legacy-5", title: "Open Family Health", note: "Review care and health notes.", done: false },
    ],
    artifacts: [
      { title: "Creative Works", location: "Writers Lounge / Books", note: "Books, scripts, narration, and story projects." },
      { title: "Render Outputs", location: "Render Lab", note: "Videos, scenes, and artifact pipeline outputs." },
      { title: "Publisher Queue", location: "Publisher Hub", note: "Release handoff, product metadata, and publishing work." },
      { title: "Family Budget", location: "Family Budget / Money", note: "Household money, accounts, goals, and actions." },
    ],
    sections: [
      "What this OS is",
      "How to use Homie",
      "Family notes",
      "Important checklist",
      "Project status",
      "Creative works and artifacts",
      "Health and house guidance",
    ],
  };
}

function findModeFromCommand(text: string) {
  const q = text.toLowerCase();
  return WORKSPACE_MODES.find((mode) => q.includes(mode.id) || q.includes(mode.name.toLowerCase()) || q.includes(mode.name.toLowerCase().replace(" mode", "")));
}

function findPanelFromCommand(text: string) {
  const q = text.toLowerCase();
  return PANEL_META.find((p) => {
    const title = p.title.toLowerCase();
    const id = p.id.toLowerCase();
    return q.includes(title) || q.includes(id) || q.includes(title.replace(/\s+/g, ""));
  });
}

function parseHomieCommand(input: string) {
  const raw = input.trim();
  const text = raw.toLowerCase();
  if (!text) return { kind: "empty", target: "", label: "Empty command" };

  const mode = findModeFromCommand(text);
  const panel = findPanelFromCommand(text);

  if (text.includes("legacy") && (text.includes("open first") || text.includes("show") || text.includes("family"))) {
    return { kind: "legacy", target: "legacy", label: "Show Legacy Open First" };
  }
  if ((text.includes("apply") || text.includes("mode") || text.includes("war room") || text.includes("calm")) && mode) {
    return { kind: "mode", target: mode.id, label: `Apply ${mode.name}` };
  }
  if ((text.includes("why") || text.includes("explain") || text.includes("bad") || text.includes("warn")) && panel) {
    return { kind: "why", target: panel.id, label: `Explain ${panel.title}` };
  }
  if ((text.includes("open") || text.includes("go to") || text.includes("launch")) && panel) {
    return { kind: "open", target: panel.id, label: `Open ${panel.title}` };
  }
  if ((text.includes("focus") || text.includes("bring up")) && panel) {
    return { kind: "focus", target: panel.id, label: `Focus ${panel.title}` };
  }
  if ((text.includes("reset") || text.includes("fix layout") || text.includes("clean layout")) && panel) {
    return { kind: "reset-request", target: panel.id, label: `Request reset for ${panel.title}` };
  }
  if (text.includes("doctor") || text.includes("scan")) return { kind: "scan", target: "doctor", label: "Run OS Doctor scan" };
  if (text.includes("receipts") || text.includes("ledger")) return { kind: "receipts", target: "receipts", label: "Open receipts ledger" };

  return { kind: "note", target: raw, label: "Saved operator note" };
}

function rememberHomieCommand(entry: any) {
  const log = readJSON<any[]>(HOMIE_COMMAND_LOG_KEY, []);
  writeJSON(HOMIE_COMMAND_LOG_KEY, [{ id: `hcmd_${Date.now()}`, ts: Date.now(), ...entry }, ...log].slice(0, 40));
}

function homieCommandExamples() {
  return [
    "why is Security bad",
    "open Trading",
    "focus Family Budget",
    "apply Family Legacy Mode",
    "apply Trading War Room",
    "show legacy open first",
    "reset Builder layout",
    "run doctor scan",
    "open receipts ledger",
  ];
}

export default function FairlyGodModeHUD({ activePanelId, onNavigate }: { activePanelId: string; onNavigate: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("Doctor");
  const [receipts, setReceipts] = useState<Receipt[]>(() => readJSON<Receipt[]>(RECEIPTS_KEY, []));
  const [selectedPanel, setSelectedPanel] = useState<string>(() => normalizePanelId(activePanelId));
  const [homieCommand, setHomieCommand] = useState("");
  const [homieReply, setHomieReply] = useState(
    'Try: "why is Security bad", "open Trading", "apply Family Legacy Mode", or "reset Builder layout".'
  );
  const [legacy, setLegacy] = useState<any>(() => readJSON(LEGACY_KEY, defaultLegacyState()));
  const [ledgerQuery, setLedgerQuery] = useState("");
  const [showReceiptJson, setShowReceiptJson] = useState(false);
  const [legacyDraft, setLegacyDraft] = useState<any>(() => readJSON(LEGACY_KEY, defaultLegacyState()));
  const [showLegacyExport, setShowLegacyExport] = useState(false);
  const [backupImportText, setBackupImportText] = useState("");
  const [showBackupJson, setShowBackupJson] = useState(false);

  const active = normalizePanelId(activePanelId);
  const activeMeta = getPanelMeta(active);

  useEffect(() => {
    const opened = readJSON<Record<string, number>>("oddengine:fairlygodmode:lastOpened:v1", {});
    opened[active] = Date.now();
    writeJSON("oddengine:fairlygodmode:lastOpened:v1", opened);
  }, [active]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "g") {
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!receipts.length) setReceipts(scanReceipts());
  }, [receipts.length]);

  useEffect(() => {
    const mode = readJSON<any>(MODE_KEY, null);
    try {
      if (mode?.id) document.body.dataset.fgmMode = mode.id;
    } catch {}
  }, []);

  const receiptMap = useMemo(() => new Map(receipts.map((r) => [r.panelId, r])), [receipts]);
  const selected = receiptMap.get(normalizePanelId(selectedPanel)) || scorePanel(selectedPanel);
  const badCount = receipts.filter((r) => r.status === "bad").length;
  const warnCount = receipts.filter((r) => r.status === "warn").length;
  const goodCount = receipts.filter((r) => r.status === "good").length;
  const visibleCards = typeof document === "undefined" ? 0 : document.querySelectorAll(".panelMain .card").length;
  const overflowWarnings =
    typeof document === "undefined"
      ? 0
      : Array.from(document.querySelectorAll<HTMLElement>(".panelMain .card")).filter((el) => el.scrollWidth > el.clientWidth + 8).length;

  const filteredReceipts = useMemo(() => {
    const q = ledgerQuery.trim().toLowerCase();
    const list = receipts.length ? receipts : PANEL_META.map((p) => scorePanel(p.id));
    if (!q) return list;
    return list.filter((r) => `${r.panelId} ${r.title} ${r.section} ${r.status} ${r.reasons.join(" ")} ${r.bestNextAction}`.toLowerCase().includes(q));
  }, [receipts, ledgerQuery]);

  const panelGroups = useMemo(() => {
    const groups: Record<string, Receipt[]> = {};
    for (const receipt of receipts.length ? receipts : PANEL_META.map((p) => scorePanel(p.id))) {
      if (!groups[receipt.section]) groups[receipt.section] = [];
      groups[receipt.section].push(receipt);
    }
    return groups;
  }, [receipts]);

  function runScan() {
    setReceipts(scanReceipts());
  }

  function safeReset(panelId: string) {
    const meta = getPanelMeta(panelId);
    const ok = window.confirm(`Reset FairlyGOD layout memory for ${meta.title}? This does not delete panel data.`);
    if (!ok) return;
    const count = clearPanelLayout(meta.id);
    window.alert(`Reset ${count} layout key(s) for ${meta.title}.`);
    runScan();
  }

  function safeSeed(panelId: string) {
    const meta = getPanelMeta(panelId);
    const ok = window.confirm(`Seed starter state for ${meta.title}? This only fills empty tracked keys and skips chats/settings.`);
    if (!ok) return;
    const keys = seedStarterState(meta.id);
    window.alert(keys.length ? `Seeded ${keys.length} key(s).` : "Nothing safe to seed.");
    runScan();
  }

  function exportLedger() {
    const data = {
      exportedAt: Date.now(),
      activePanel: active,
      receipts: receipts.length ? receipts : scanReceipts(),
      history: readJSON<any[]>(RECEIPT_HISTORY_KEY, []),
    };
    const json = JSON.stringify(data, null, 2);
    writeJSON(RECEIPT_EXPORT_KEY, data);
    copyText(json);
    window.alert("Truth receipt ledger copied to clipboard when available, and saved locally as lastReceiptExport.");
  }

  function copySelectedReceipt() {
    const json = JSON.stringify(selected, null, 2);
    copyText(json);
    window.alert("Selected panel receipt copied to clipboard when available.");
  }

  function executeHomieCommand() {
    const parsed = parseHomieCommand(homieCommand);
    writeJSON(HOMIE_COMMAND_KEY, { command: homieCommand, parsed, ts: Date.now() });

    if (parsed.kind === "empty") {
      setHomieReply("Say what you want Homie to operate: open a panel, explain a warning, apply a mode, run scan, or request a layout reset.");
      return;
    }

    if (parsed.kind === "mode") {
      const mode = WORKSPACE_MODES.find((m) => m.id === parsed.target);
      if (!mode) {
        const reply = "I found a mode request, but not a known workspace mode.";
        setHomieReply(reply);
        rememberHomieCommand({ command: homieCommand, parsed, status: "warn", reply });
        return;
      }
      applyMode(mode, onNavigate);
      const reply = `Applied ${mode.name}. I changed only safe operator preferences: active panel, pins, shell/command density, Homie tone hint, and visual mode.`;
      setHomieReply(reply);
      rememberHomieCommand({ command: homieCommand, parsed, status: "success", reply });
      return;
    }

    if (parsed.kind === "open") {
      onNavigate(parsed.target);
      setSelectedPanel(parsed.target);
      const reply = `Opening ${getPanelMeta(parsed.target).title}.`;
      setHomieReply(reply);
      rememberHomieCommand({ command: homieCommand, parsed, status: "success", reply });
      return;
    }

    if (parsed.kind === "focus") {
      onNavigate(parsed.target);
      setSelectedPanel(parsed.target);
      setOpen(false);
      const reply = `Focusing ${getPanelMeta(parsed.target).title}.`;
      setHomieReply(reply);
      rememberHomieCommand({ command: homieCommand, parsed, status: "success", reply });
      return;
    }

    if (parsed.kind === "why") {
      setSelectedPanel(parsed.target);
      setTab("Panels");
      const r = receiptMap.get(parsed.target) || scorePanel(parsed.target);
      const reply = `${getPanelMeta(parsed.target).title}: ${r.reasons[0]} Fix: ${r.bestNextAction}`;
      setHomieReply(reply);
      rememberHomieCommand({ command: homieCommand, parsed, status: r.status, reply });
      return;
    }

    if (parsed.kind === "reset-request") {
      setSelectedPanel(parsed.target);
      setTab("Panels");
      writeJSON(HOMIE_PENDING_CONFIRM_KEY, { kind: "reset-layout", panelId: parsed.target, requestedAt: Date.now(), command: homieCommand });
      const reply = `Reset request staged for ${getPanelMeta(parsed.target).title}. I will not reset anything from text alone. Use the confirmed Reset layout button on the panel card.`;
      setHomieReply(reply);
      rememberHomieCommand({ command: homieCommand, parsed, status: "warn", reply });
      return;
    }

    if (parsed.kind === "scan") {
      setReceipts(scanReceipts());
      setTab("Doctor");
      const reply = "OS Doctor scan refreshed. Check Doctor for top risks and Receipts for the ledger.";
      setHomieReply(reply);
      rememberHomieCommand({ command: homieCommand, parsed, status: "success", reply });
      return;
    }

    if (parsed.kind === "receipts") {
      setTab("Receipts");
      const reply = "Opening the Truth Receipts ledger.";
      setHomieReply(reply);
      rememberHomieCommand({ command: homieCommand, parsed, status: "success", reply });
      return;
    }

    if (parsed.kind === "legacy") {
      setTab("Legacy");
      const reply = "Opening the Family Legacy Open First lane.";
      setHomieReply(reply);
      rememberHomieCommand({ command: homieCommand, parsed, status: "success", reply });
      return;
    }

    const reply = "I saved that as an operator note. For action routing, try open/focus/why/apply/reset/scan/receipts/legacy.";
    setHomieReply(reply);
    rememberHomieCommand({ command: homieCommand, parsed, status: "info", reply });
  }

  function saveLegacyDraft(next = legacyDraft) {
    const updated = { ...next, updatedAt: Date.now() };
    setLegacy(updated);
    setLegacyDraft(updated);
    writeJSON(LEGACY_KEY, updated);
    return updated;
  }

  function updateLegacyField(field: string, value: any) {
    setLegacyDraft((prev: any) => ({ ...prev, [field]: value }));
  }

  function toggleLegacyChecklist(id: string) {
    const next = {
      ...legacyDraft,
      checklist: (legacyDraft.checklist || []).map((item: any) => item.id === id ? { ...item, done: !item.done } : item),
    };
    saveLegacyDraft(next);
  }

  function addLegacyChecklistItem() {
    const title = window.prompt("Checklist item title");
    if (!title) return;
    const note = window.prompt("Short note for this item") || "";
    const next = {
      ...legacyDraft,
      checklist: [...(legacyDraft.checklist || []), { id: `legacy-${Date.now()}`, title, note, done: false }],
    };
    saveLegacyDraft(next);
  }

  function addLegacyProjectStatus() {
    const title = window.prompt("Project name");
    if (!title) return;
    const status = window.prompt("Status") || "In progress";
    const note = window.prompt("Short note") || "";
    const next = {
      ...legacyDraft,
      projectStatus: [...(legacyDraft.projectStatus || []), { title, status, note }],
    };
    saveLegacyDraft(next);
  }

  function addLegacyArtifact() {
    const title = window.prompt("Artifact title");
    if (!title) return;
    const location = window.prompt("Where should family find it?") || "";
    const note = window.prompt("Short note") || "";
    const next = {
      ...legacyDraft,
      artifacts: [...(legacyDraft.artifacts || []), { title, location, note }],
    };
    saveLegacyDraft(next);
  }

  function buildLegacySummary() {
    const data = legacyDraft || legacy || defaultLegacyState();
    const checklist = (data.checklist || []).map((item: any) => `- [${item.done ? "x" : " "}] ${item.title}: ${item.note || ""}`).join("\n");
    const projects = (data.projectStatus || []).map((item: any) => `- ${item.title} (${item.status}): ${item.note || ""}`).join("\n");
    const artifacts = (data.artifacts || []).map((item: any) => `- ${item.title} - ${item.location}: ${item.note || ""}`).join("\n");

    return [
      "# FairlyOdd OS - Open First",
      "",
      data.welcomeBody || "",
      "",
      "## Family message",
      data.familyMessage || "",
      "",
      "## What this OS is",
      data.whatThisIs || "",
      "",
      "## How to use Homie",
      data.howToUseHomie || "",
      "",
      "## Important notes",
      data.importantNotes || "",
      "",
      "## Emergency / must-know notes",
      data.emergencyNotes || "",
      "",
      "## Checklist",
      checklist || "- No checklist items yet.",
      "",
      "## Project status",
      projects || "- No project status items yet.",
      "",
      "## Creative works and artifacts",
      artifacts || "- No artifact lanes yet.",
      "",
      `Updated: ${safeDate(data.updatedAt)}`,
    ].join("\n");
  }

  function exportLegacySummary() {
    const summary = buildLegacySummary();
    writeJSON(LEGACY_EXPORT_KEY, { exportedAt: Date.now(), summary, data: legacyDraft });
    copyText(summary);
    setShowLegacyExport(true);
    window.alert("Legacy Open First summary copied to clipboard when available and saved locally.");
  }

  function resetLegacyDefaults() {
    const ok = window.confirm("Reset Legacy Open First fields to starter defaults? This only affects local legacy draft data.");
    if (!ok) return;
    const next = defaultLegacyState();
    saveLegacyDraft(next);
  }
  function downloadLegacyMarkdown() { const summary = buildLegacySummary(); writeJSON(LEGACY_EXPORT_KEY, { exportedAt: Date.now(), summary, data: legacyDraft }); downloadTextFile("FairlyOdd_Open_First_Legacy.md", summary, "text/markdown"); }
  function downloadLegacyJson() { const data = { exportedAt: Date.now(), data: legacyDraft }; writeJSON(LEGACY_EXPORT_KEY, data); downloadTextFile("FairlyOdd_Open_First_Legacy.json", JSON.stringify(data, null, 2), "application/json"); }
  function createBackupSnapshot() { const backup = collectFairlyGodModeBackup(); const snapshots = readJSON<any[]>(BACKUP_SNAPSHOT_KEY, []); writeJSON(BACKUP_SNAPSHOT_KEY, [{ id: `snapshot_${Date.now()}`, ...backup }, ...snapshots].slice(0, 12)); window.alert(`Snapshot created with ${backup.keyCount} key(s).`); }
  function downloadBackupSnapshot() { const backup = collectFairlyGodModeBackup(); downloadTextFile(`OddEngine_FairlyGodMode_Backup_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), "application/json"); }
  function restoreBackupFromText() { const ok = window.confirm("Restore this FairlyGodMode backup into localStorage? This can change layouts, modes, receipts, legacy notes, and operator logs."); if (!ok) return; try { const parsed = JSON.parse(backupImportText); const count = restoreFairlyGodModeBackup(parsed); window.alert(`Restored ${count} key(s). Reload the app to fully apply layouts and modes.`); } catch (err: any) { window.alert(`Restore failed: ${err?.message || String(err)}`); } }
  function restoreSnapshot(snapshot: any) { const ok = window.confirm("Restore this local snapshot? This can change layouts, modes, receipts, legacy notes, and operator logs."); if (!ok) return; try { const count = restoreFairlyGodModeBackup(snapshot); window.alert(`Restored ${count} key(s). Reload the app to fully apply layouts and modes.`); } catch (err: any) { window.alert(`Restore failed: ${err?.message || String(err)}`); } }
  function clearVisualMode() {
    localStorage.removeItem(MODE_KEY);
    localStorage.removeItem("oddengine:homie:toneHint:v1");
    try {
      delete document.body.dataset.fgmMode;
    } catch {}
    window.alert("Workspace mode cleared. Pinned panels were left alone for safety.");
  }

  return (
    <>
      <button
        type="button"
        className="fairlyGodModeLauncher fgGodLauncher"
        data-fg-god-launcher="true"
        onClick={() => setOpen((v) => !v)}
        title="FairlyGodMode (Ctrl+Shift+G)"
      >
        <span>FG</span>
        <span>GOD</span>
      </button>

      {open && (
        <div className="fairlyGodModeBackdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <div className="fairlyGodModeDeck fgGodDeck card">
            <div className="fgGodTop">
              <div>
                <div className="small shellEyebrow">FAIRLYGODMODE - FULL HUD REPAIR</div>
                <div className="fairlyGodModeTitle fgGodDeckTitle">FairlyGodMode</div>
                <div className="fairlyGodModeActiveLine fgGodActivePanelLine">Active: {activeMeta.title}</div>
                <div className="sub">OS Doctor, workspace modes, truth receipts, Homie operator bridge, and Legacy Open First.</div>
              </div>
              <div className="fgGodTopActions">
                <button className="tabBtn" onClick={runScan}>Scan</button>
                <button className="tabBtn" onClick={() => setOpen(false)}>Close</button>
              </div>
            </div>

            <div className="fgGodTabs">
              {(["Doctor", "Panels", "Modes", "Receipts", "Homie", "Legacy", "Safety"] as Tab[]).map((item) => (
                <button key={item} className={`tabBtn ${tab === item ? "active" : ""}`} onClick={() => setTab(item)}>{item}</button>
              ))}
            </div>

            {tab === "Doctor" && (
              <div className="fgGodSection">
                <div className="fgGodMetricGrid">
                  <div className="fgGodMetric card softCard"><b>{PANEL_META.length}</b><span>registered panels</span></div>
                  <div className="fgGodMetric card softCard"><b>{goodCount}</b><span>good</span></div>
                  <div className="fgGodMetric card softCard"><b>{warnCount}</b><span>warn</span></div>
                  <div className="fgGodMetric card softCard"><b>{badCount}</b><span>bad</span></div>
                  <div className="fgGodMetric card softCard"><b>{visibleCards}</b><span>visible cards</span></div>
                  <div className="fgGodMetric card softCard"><b>{overflowWarnings}</b><span>overflow warnings</span></div>
                </div>

                <div className={`fgGodReasonCard ${badCount ? "bad" : warnCount ? "warn" : "good"}`}>
                  <div className="fgGodReasonTitle">Doctor readout</div>
                  <div className="fgGodReasonText">
                    {badCount ? `${badCount} panel(s) need attention before relying on them.` : warnCount ? `${warnCount} panel(s) need quick setup or data review.` : "The OS looks healthy from local signals."}
                  </div>
                  <div className="fgGodDoctorActions">
                    <button className="tabBtn active" onClick={runScan}>Refresh scan</button>
                    <button className="tabBtn" onClick={() => setTab("Panels")}>Review panels</button>
                    <button className="tabBtn" onClick={() => setTab("Modes")}>Open modes</button>
                    <button className="tabBtn" onClick={() => setTab("Legacy")}>Open First</button>
                  </div>
                </div>

                <div className="fgGodQueue">
                  {(receipts.length ? receipts : PANEL_META.map((p) => scorePanel(p.id)))
                    .filter((r) => r.status !== "good")
                    .slice(0, 8)
                    .map((r) => (
                      <div key={r.panelId} className={`fgGodQueueItem ${r.status}`}>
                        <div>
                          <b>{r.title}</b>
                          <span>{r.reasons[0]}</span>
                        </div>
                        <button className="tabBtn" onClick={() => { setSelectedPanel(r.panelId); setTab("Panels"); }}>Fix</button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {tab === "Panels" && (
              <div className="fgGodSection">
                <div className={`fgGodReasonCard ${selected.status}`}>
                  <div className="fgGodReasonTitle">{selected.title}: {selected.status} - {selected.score}/100</div>
                  <div className="fgGodReasonText"><b>Why:</b> {selected.reasons.join(" ")}</div>
                  <div className="fgGodReasonText" style={{ marginTop: 6 }}><b>Fix:</b> {selected.bestNextAction}</div>
                  <div className="fgGodDoctorActions">
                    <button className="tabBtn active" onClick={() => onNavigate(selected.panelId)}>Open</button>
                    <button className="tabBtn" onClick={() => { onNavigate(selected.panelId); setOpen(false); }}>Focus</button>
                    <button className="tabBtn" onClick={() => setPanelLock(selected.panelId, true)}>Lock</button>
                    <button className="tabBtn" onClick={() => setPanelLock(selected.panelId, false)}>Unlock</button>
                    <button className="tabBtn" onClick={() => safeSeed(selected.panelId)}>Seed safe starter</button>
                    <button className="tabBtn danger" onClick={() => safeReset(selected.panelId)}>Reset layout</button>
                  </div>
                </div>

                {Object.entries(panelGroups).map(([section, group]) => (
                  <div className="fgGodGroup" key={section}>
                    <div className="fgGodGroupTitle">{section}</div>
                    <div className="fgGodPanelGrid">
                      {group.map((r) => (
                        <div key={r.panelId} className={`fgGodPanelRow fairlyGodPanelRow ${selected.panelId === r.panelId ? "selected" : ""}`}>
                          <button className="fgGodPanelRowMain fairlyGodPanelRowMain" onClick={() => setSelectedPanel(r.panelId)}>
                            <span className="fgGodPanelIcon"><OddIcon id={r.panelId} /></span>
                            <span className="fgGodPanelText">
                              <b>{r.title}</b>
                              <small>{r.currentRisk}</small>
                            </span>
                            <span className={`badge ${r.status}`}>{r.status}</span>
                          </button>
                          <div className="fgGodPanelActions fairlyGodPanelActions">
                            <button onClick={() => onNavigate(r.panelId)}>Open</button>
                            <button onClick={() => { onNavigate(r.panelId); setOpen(false); }}>Focus</button>
                            <button onClick={() => setSelectedPanel(r.panelId)}>Why</button>
                            <button onClick={() => safeSeed(r.panelId)}>Seed</button>
                            <button className="danger" onClick={() => safeReset(r.panelId)}>Reset</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "Modes" && (
              <div className="fgGodSection">
                {(() => {
                  const activeMode = readJSON<any>(MODE_KEY, null);
                  const history = readJSON<any[]>(MODE_HISTORY_KEY, []);
                  return (
                    <>
                      {activeMode?.id && (
                        <div className="fgGodModeBanner">
                          <div className="fgGodModeBannerLeft">
                            <div className="fgGodModeBannerTitle">Active mode: {activeMode.icon} {activeMode.name}</div>
                            <div className="fgGodModeBannerSub">{activeMode.description}</div>
                          </div>
                          <div className="fgGodModeBannerActions">
                            <button className="tabBtn" onClick={() => onNavigate(activeMode.activePanel)}>Open mode panel</button>
                            <button className="tabBtn danger" onClick={clearVisualMode}>Clear visual mode</button>
                          </div>
                        </div>
                      )}

                      <div className="fgGodModePreview">
                        <div className="fgGodReasonTitle">Workspace Modes</div>
                        <div className="fgGodReasonText">Modes are safe presets for how the OS feels and what panels are easiest to reach.</div>
                      </div>

                      <div className="fgGodModeGrid">
                        {WORKSPACE_MODES.map((mode) => (
                          <div key={mode.id} className="fgGodModeCard card softCard">
                            <div className="fgGodModeTitle">{mode.icon} {mode.name}</div>
                            <div className="fgGodModeIntent">{mode.description}</div>
                            <div className="fgGodModeMeta">
                              <span className="badge">Open: {getPanelMeta(mode.activePanel).title}</span>
                              <span className="badge">{mode.pins.length} pins</span>
                              <span className="badge">Tone: {mode.tone}</span>
                            </div>
                            <div className="small" style={{ marginTop: 8 }}>Pins: {mode.pins.slice(0, 6).join(", ")}{mode.pins.length > 6 ? "..." : ""}</div>
                            <div className="fgGodModeActions">
                              <button className="tabBtn active" onClick={() => applyMode(mode, onNavigate)}>Apply mode</button>
                              <button className="tabBtn" onClick={() => {
                                writeJSON(MODE_KEY, { ...mode, previewedAt: Date.now(), previewOnly: true });
                                try { document.body.dataset.fgmMode = mode.id; } catch {}
                                window.alert(`Previewed ${mode.name}. Apply mode to pin/open panels.`);
                              }}>Preview tone</button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="fgGodReasonCard">
                        <div className="fgGodReasonTitle">Mode history</div>
                        <div className="fgGodReasonText">Every applied mode writes a local receipt so the OS can explain what changed.</div>
                      </div>
                      <div className="fgGodModeHistory">
                        {history.length ? history.slice(0, 8).map((item, idx) => (
                          <div key={`${item.id}-${item.appliedAt || idx}`} className="fgGodModeHistoryItem">
                            <div>
                              <b>{item.icon} {item.name}</b>
                              <span>{item.appliedAt ? safeDate(item.appliedAt) : "preview"} - {item.description}</span>
                            </div>
                            <button className="tabBtn" onClick={() => applyMode(item, onNavigate)}>Reapply</button>
                          </div>
                        )) : (
                          <div className="fgGodModeHistoryItem">
                            <div><b>No mode receipts yet</b><span>Apply a mode to start the local history.</span></div>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {tab === "Receipts" && (
              <div className="fgGodSection">
                <div className="fgGodReasonCard">
                  <div className="fgGodReasonTitle">Panel Truth Receipts + Readiness Ledger</div>
                  <div className="fgGodReasonText">Receipts are local audit records generated by OS Doctor.</div>
                </div>

                <div className="fgGodLedgerToolbar">
                  <div className="left fgGodLedgerSearch">
                    <input value={ledgerQuery} onChange={(e) => setLedgerQuery(e.target.value)} placeholder="Search receipts by panel, risk, reason, fix..." />
                  </div>
                  <div className="right">
                    <button className="tabBtn active" onClick={() => setReceipts(scanReceipts())}>Run scan</button>
                    <button className="tabBtn" onClick={exportLedger}>Copy/export ledger</button>
                    <button className="tabBtn" onClick={() => setShowReceiptJson((v) => !v)}>{showReceiptJson ? "Hide JSON" : "Show JSON"}</button>
                  </div>
                </div>

                <div className="fgGodLedgerStats">
                  <div className="fgGodLedgerStat card softCard"><b>{filteredReceipts.length}</b><span>shown receipts</span></div>
                  <div className="fgGodLedgerStat card softCard"><b>{filteredReceipts.filter((r) => r.status === "bad").length}</b><span>bad</span></div>
                  <div className="fgGodLedgerStat card softCard"><b>{filteredReceipts.filter((r) => r.status === "warn").length}</b><span>warn</span></div>
                  <div className="fgGodLedgerStat card softCard"><b>{readJSON<any[]>(RECEIPT_HISTORY_KEY, []).length}</b><span>scan history</span></div>
                </div>

                <div className={`fgGodReceiptExpanded ${selected.status}`}>
                  <div className="fgGodReceiptHeader">
                    <div>
                      <h4>{selected.title} receipt</h4>
                      <p>{selected.status} - {selected.score}/100 - scanned {formatAge(selected.lastScan)} - data age {formatAge(selected.dataAge)}</p>
                    </div>
                    <div className="fgGodReceiptActions">
                      <button className="tabBtn" onClick={() => onNavigate(selected.panelId)}>Open</button>
                      <button className="tabBtn" onClick={() => { onNavigate(selected.panelId); setOpen(false); }}>Focus</button>
                      <button className="tabBtn" onClick={copySelectedReceipt}>Copy receipt</button>
                      <button className="tabBtn danger" onClick={() => safeReset(selected.panelId)}>Reset layout</button>
                    </div>
                  </div>
                  <div className="fgGodReceiptFacts">
                    <div className="fgGodReceiptFact"><b>Risk</b><span>{selected.currentRisk}</span></div>
                    <div className="fgGodReceiptFact"><b>Dependency</b><span>{selected.backendDependency}</span></div>
                    <div className="fgGodReceiptFact"><b>Empty state</b><span>{selected.emptyStatePercent}%</span></div>
                    <div className="fgGodReceiptFact"><b>Storage keys</b><span>{selected.storageKeys.length}</span></div>
                    <div className="fgGodReceiptFact"><b>Missing keys</b><span>{selected.missingKeys.length}</span></div>
                    <div className="fgGodReceiptFact"><b>Last opened</b><span>{safeDate(selected.lastOpened)}</span></div>
                  </div>
                  <div className="fgGodReceiptDetailGrid">
                    <div className="fgGodReceiptDetail">
                      <b>Reasons</b>
                      <ul>{selected.reasons.map((reason, idx) => <li key={idx}>{reason}</li>)}</ul>
                    </div>
                    <div className="fgGodReceiptDetail">
                      <b>Fixes</b>
                      <ul>{selected.fixes.map((fix, idx) => <li key={idx}>{fix}</li>)}</ul>
                    </div>
                  </div>
                  {showReceiptJson && <pre className="fgGodReceiptJson">{JSON.stringify(selected, null, 2)}</pre>}
                </div>

                <div className="fgGodReceiptList">
                  {filteredReceipts.map((r) => (
                    <div key={r.panelId} className={`fgGodReceipt ${r.status}`}>
                      <div>
                        <b>{r.title}</b>
                        <span>{r.status} - {r.score}/100 - data {formatAge(r.dataAge)} - {r.backendDependency}</span>
                        <small>{r.bestNextAction}</small>
                      </div>
                      <button className="tabBtn" onClick={() => setSelectedPanel(r.panelId)}>Inspect</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "Homie" && (
              <div className="fgGodSection">
                <div className="fgGodHomieBridgeGrid">
                  <div className="fgGodHomieBridgeCard">
                    <div className="fgGodReasonCard">
                      <div className="fgGodReasonTitle">Homie Operator Bridge</div>
                      <div className="fgGodReasonText">Type what you want Homie to do. This bridge routes plain language into safe FairlyGodMode actions.</div>
                      <div className="fgGodHomieBridgeBadgeRow">
                        <span className="badge good">local only</span>
                        <span className="badge warn">resets require confirmation</span>
                        <span className="badge">no backend rewrite</span>
                      </div>
                    </div>

                    <div className="fgGodCommandBox fgGodHomieCommandRow">
                      <input value={homieCommand} onChange={(e) => setHomieCommand(e.target.value)} placeholder='Try: "why is Security bad" or "apply Family Legacy Mode"' />
                      <button className="tabBtn active" onClick={executeHomieCommand}>Run command</button>
                    </div>

                    <div className="fgGodHomieCommandHints">
                      {homieCommandExamples().map((example) => (
                        <button key={example} className="tabBtn" onClick={() => setHomieCommand(example)}>{example}</button>
                      ))}
                    </div>

                    <div className={`fgGodHomieReply ${String(homieReply).toLowerCase().includes("reset") ? "warn" : ""}`}>
                      <b>Homie operator reply</b>
                      <span>{homieReply}</span>
                    </div>
                  </div>

                  <div className="fgGodHomieBridgeCard">
                    <div className="fgGodReasonCard">
                      <div className="fgGodReasonTitle">Operator command log</div>
                      <div className="fgGodReasonText">Recent routed commands are stored locally for inspection and debugging.</div>
                    </div>
                    <div className="fgGodHomieLog">
                      {readJSON<any[]>(HOMIE_COMMAND_LOG_KEY, []).slice(0, 12).map((item) => (
                        <div key={item.id} className="fgGodHomieLogItem">
                          <b>{item.command || "command"}</b>
                          <span>{safeDate(item.ts)} - {item.status || "info"} - {item.reply || item.parsed?.label || "routed"}</span>
                        </div>
                      ))}
                      {!readJSON<any[]>(HOMIE_COMMAND_LOG_KEY, []).length && (
                        <div className="fgGodHomieLogItem">
                          <b>No commands routed yet</b>
                          <span>Run a Homie operator command to start the local log.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tab === "Legacy" && (
              <div className="fgGodSection">
                <div className="fgGodLegacyVaultHero">
                  <div className="fgGodLegacyVaultTitle">Open First - Family Legacy Vault</div>
                  <div className="fgGodLegacyVaultSub">
                    {legacyDraft.welcomeBody}
                  </div>
                  <div className="fgGodLegacyVaultActions">
                    <button className="tabBtn active" onClick={() => applyMode(WORKSPACE_MODES[0], onNavigate)}>Apply Family Legacy Mode</button>
                    <button className="tabBtn" onClick={() => onNavigate("Homie")}>Open Homie</button>
                    <button className="tabBtn" onClick={() => onNavigate("Books")}>Creative Works</button>
                    <button className="tabBtn" onClick={() => onNavigate("RenderLab")}>Render Lab</button>
                    <button className="tabBtn" onClick={() => onNavigate("FamilyBudget")}>Family Budget</button>
                    <button className="tabBtn" onClick={() => onNavigate("FamilyHealth")}>Family Health</button>
                    <button className="tabBtn" onClick={exportLegacySummary}>Copy/export summary</button>
                    <button className="tabBtn" onClick={downloadLegacyMarkdown}>Download markdown</button>
                    <button className="tabBtn" onClick={downloadLegacyJson}>Download JSON</button>
                    <button className="tabBtn" onClick={downloadLegacyMarkdown}>Download markdown</button>
                    <button className="tabBtn" onClick={downloadLegacyJson}>Download JSON</button>
                  </div>
                </div>

                <div className="fgGodLegacyFamilyHint">
                  Family-friendly rule: start here, read the message, open Homie, then use the checklist. No coding knowledge needed.
                </div>

                <div className="fgGodLegacyVaultGrid">
                  <div className="fgGodLegacyPanel">
                    <h3>Family message</h3>
                    <textarea
                      className="fgGodLegacyTextArea"
                      value={legacyDraft.familyMessage || ""}
                      onChange={(e) => updateLegacyField("familyMessage", e.target.value)}
                      onBlur={() => saveLegacyDraft()}
                    />
                    <h3>What this OS is</h3>
                    <textarea
                      className="fgGodLegacyTextArea"
                      value={legacyDraft.whatThisIs || ""}
                      onChange={(e) => updateLegacyField("whatThisIs", e.target.value)}
                      onBlur={() => saveLegacyDraft()}
                    />
                    <h3>How to use Homie</h3>
                    <textarea
                      className="fgGodLegacyTextArea"
                      value={legacyDraft.howToUseHomie || ""}
                      onChange={(e) => updateLegacyField("howToUseHomie", e.target.value)}
                      onBlur={() => saveLegacyDraft()}
                    />
                  </div>

                  <div className="fgGodLegacyPanel">
                    <h3>Important notes</h3>
                    <textarea
                      className="fgGodLegacyTextArea"
                      value={legacyDraft.importantNotes || ""}
                      onChange={(e) => updateLegacyField("importantNotes", e.target.value)}
                      onBlur={() => saveLegacyDraft()}
                    />
                    <h3>Emergency / must-know notes</h3>
                    <textarea
                      className="fgGodLegacyTextArea"
                      value={legacyDraft.emergencyNotes || ""}
                      onChange={(e) => updateLegacyField("emergencyNotes", e.target.value)}
                      onBlur={() => saveLegacyDraft()}
                    />
                    <div className="fgGodLegacyVaultActions">
                      <button className="tabBtn active" onClick={() => saveLegacyDraft()}>Save notes</button>
                      <button className="tabBtn danger" onClick={resetLegacyDefaults}>Reset starter defaults</button>
                    </div>
                  </div>
                </div>

                <div className="fgGodLegacyVaultGrid">
                  <div className="fgGodLegacyPanel">
                    <div className="row spread wrap">
                      <h3>Priority checklist</h3>
                      <button className="tabBtn" onClick={addLegacyChecklistItem}>Add item</button>
                    </div>
                    <div className="fgGodLegacyList">
                      {(legacyDraft.checklist || []).map((item: any) => (
                        <div key={item.id} className={`fgGodLegacyItem ${item.done ? "done" : ""}`}>
                          <input type="checkbox" checked={!!item.done} onChange={() => toggleLegacyChecklist(item.id)} />
                          <div className="fgGodLegacyItemText">
                            <b>{item.title}</b>
                            <span>{item.note}</span>
                          </div>
                          <div className="fgGodLegacyMiniActions">
                            <button onClick={() => {
                              const title = window.prompt("Edit title", item.title) || item.title;
                              const note = window.prompt("Edit note", item.note || "") || item.note;
                              saveLegacyDraft({ ...legacyDraft, checklist: (legacyDraft.checklist || []).map((x: any) => x.id === item.id ? { ...x, title, note } : x) });
                            }}>Edit</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="fgGodLegacyPanel">
                    <div className="row spread wrap">
                      <h3>Project status</h3>
                      <button className="tabBtn" onClick={addLegacyProjectStatus}>Add project</button>
                    </div>
                    <div className="fgGodLegacyList">
                      {(legacyDraft.projectStatus || []).map((item: any, idx: number) => (
                        <div key={`${item.title}-${idx}`} className="fgGodLegacyItem">
                          <span className="badge">{item.status}</span>
                          <div className="fgGodLegacyItemText">
                            <b>{item.title}</b>
                            <span>{item.note}</span>
                          </div>
                          <div className="fgGodLegacyMiniActions">
                            <button onClick={() => {
                              const title = window.prompt("Project", item.title) || item.title;
                              const status = window.prompt("Status", item.status) || item.status;
                              const note = window.prompt("Note", item.note || "") || item.note;
                              saveLegacyDraft({ ...legacyDraft, projectStatus: (legacyDraft.projectStatus || []).map((x: any, i: number) => i === idx ? { title, status, note } : x) });
                            }}>Edit</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="fgGodLegacyPanel">
                  <div className="row spread wrap">
                    <h3>Creative works and artifact lanes</h3>
                    <button className="tabBtn" onClick={addLegacyArtifact}>Add artifact lane</button>
                  </div>
                  <div className="fgGodLegacyArtifactGrid">
                    {(legacyDraft.artifacts || []).map((item: any, idx: number) => (
                      <div key={`${item.title}-${idx}`} className="fgGodLegacyArtifact">
                        <b>{item.title}</b>
                        <span><b>Where:</b> {item.location}</span>
                        <span>{item.note}</span>
                        <div className="fgGodLegacyMiniActions">
                          <button onClick={() => {
                            const title = window.prompt("Artifact title", item.title) || item.title;
                            const location = window.prompt("Location", item.location || "") || item.location;
                            const note = window.prompt("Note", item.note || "") || item.note;
                            saveLegacyDraft({ ...legacyDraft, artifacts: (legacyDraft.artifacts || []).map((x: any, i: number) => i === idx ? { title, location, note } : x) });
                          }}>Edit</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {showLegacyExport && (
                  <div className="fgGodLegacyPanel">
                    <div className="row spread wrap">
                      <h3>Export preview</h3>
                      <button className="tabBtn" onClick={() => setShowLegacyExport(false)}>Hide</button>
                    </div>
                    <pre className="fgGodLegacyExportBox">{buildLegacySummary()}</pre>
                  </div>
                )}
              </div>
            )}
{tab === "Safety" && (
              <div className="fgGodSection">
                <div className="fgGodReasonCard">
                  <div className="fgGodReasonTitle">Safety rules</div>
                  <div className="fgGodReasonText">FairlyGodMode is an operator layer. It can explain, navigate, seed starter state, and reset layout memory with confirmation. It does not rewrite panel logic.</div>
                </div>
                <div className="fgGodBackupGrid"><div className="fgGodBackupCard"><b>Backup / snapshot</b><p>Back up FairlyGodMode state: legacy notes, receipts, modes, Homie operator logs, pinned panels, collapsed nav, and CardGODMode layout keys.</p><div className="fgGodBackupActions"><button className="tabBtn active" onClick={createBackupSnapshot}>Create local snapshot</button><button className="tabBtn" onClick={downloadBackupSnapshot}>Download backup JSON</button><button className="tabBtn" onClick={() => setShowBackupJson((v) => !v)}>{showBackupJson ? "Hide JSON" : "Preview JSON"}</button></div></div><div className="fgGodBackupCard"><b>Restore backup</b><p>Paste a backup JSON file here. Restore requires confirmation and may change layouts/modes/legacy notes.</p><textarea className="fgGodLegacyTextArea" value={backupImportText} onChange={(e) => setBackupImportText(e.target.value)} placeholder="Paste backup JSON here..." /><div className="fgGodBackupActions"><button className="tabBtn danger" disabled={!backupImportText.trim()} onClick={restoreBackupFromText}>Restore pasted backup</button></div></div></div>{showBackupJson && <pre className="fgGodLegacyExportBox">{JSON.stringify(collectFairlyGodModeBackup(), null, 2)}</pre>}<div className="fgGodBackupCard"><b>Local snapshots</b><span>Recent snapshots are kept locally in this browser/Electron profile.</span><div className="fgGodSnapshotList">{readJSON<any[]>(BACKUP_SNAPSHOT_KEY, []).slice(0, 12).map((snapshot) => (<div key={snapshot.id} className="fgGodSnapshotItem"><div><b>{safeDate(snapshot.exportedAt)}</b><span>{snapshot.keyCount || 0} key(s) - {snapshot.version || "backup"}</span></div><button className="tabBtn" onClick={() => restoreSnapshot(snapshot)}>Restore</button></div>))}{!readJSON<any[]>(BACKUP_SNAPSHOT_KEY, []).length && (<div className="fgGodSnapshotItem"><div><b>No snapshots yet</b><span>Create a local snapshot to begin.</span></div></div>)}</div></div>
                <div className="fgGodSafetyList">
                  <div>No Trading logic rewrite.</div>
                  <div>No CardGODMode internal rewrite.</div>
                  <div>No Homie voice, memory, or backend rewrite.</div>
                  <div>Confirm resets and starter seeding.</div>
                  <div>Keep every fix local, reversible, and explainable.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
