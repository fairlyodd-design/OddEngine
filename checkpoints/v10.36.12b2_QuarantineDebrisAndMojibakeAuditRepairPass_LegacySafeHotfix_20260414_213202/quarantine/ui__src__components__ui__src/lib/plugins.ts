import { loadJSON, saveJSON } from "./storage";

export const USER_PLUGIN_KEY = "oddengine:plugins:user:v1";
export const UPGRADE_PACKS_KEY = "oddengine:plugins:upgradePacks:v1";
export const UPGRADE_PACK_HISTORY_KEY = "oddengine:plugins:upgradeHistory:v1";
export const UPGRADE_PACKS_EVENT = "oddengine:plugins:changed";

export type PackPermission = {
  id: string;
  label: string;
  description: string;
};

export type UpdateChannel = "stable" | "research" | "preview";

export type UpgradeSurfaceAction = {
  id: string;
  label: string;
  kind: "command" | "install-pack" | "grant-permissions" | "navigate" | "repair-dependencies";
  commandText?: string;
  panelId?: string;
  speakText?: string;
  tone?: "good" | "warn" | "bad";
};

export type UpgradeSurfaceCard = {
  id: string;
  sourcePackId: string;
  target: "assistant" | "brain";
  panelIds?: string[];
  eyebrow?: string;
  title: string;
  body: string;
  tone?: "good" | "warn" | "bad";
  actions: UpgradeSurfaceAction[];
};

export type UpgradePanelWidget = {
  id: string;
  sourcePackId: string;
  panelId: string;
  eyebrow?: string;
  title: string;
  body: string;
  tone?: "good" | "warn" | "bad";
  compact?: boolean;
  actions: UpgradeSurfaceAction[];
};

export type UpgradePackManifest = {
  id: string;
  name: string;
  version: string;
  description: string;
  category: "panel-upgrade" | "assistant-pack" | "automation-pack";
  targetPanels: string[];
  permissions?: PackPermission[];
  commands?: string[];
  actionLabels?: string[];
  summaryMessage: string;
  installPrompt?: string;
  releaseNotes?: string[];
  dependencies?: string[];
  minCoreVersion?: string;
  updateChannel?: UpdateChannel;
  updateFeedLabel?: string;
};

export type InstalledUpgradePack = {
  id: string;
  enabled: boolean;
  version: string;
  installedAt: number;
  permissions: Record<string, boolean>;
};

export type UpgradePackHistoryEntry = {
  id: string;
  packId: string;
  packName: string;
  action: "install" | "update" | "uninstall" | "enable" | "disable" | "grant-permission" | "repair-dependencies" | "update-all";
  status: "success" | "info" | "warn";
  at: number;
  detail: string;
  fromVersion?: string;
  toVersion?: string;
  channel?: UpdateChannel;
};

export const UPGRADE_PACKS: UpgradePackManifest[] = [
  {
    id: "news-pro-pack",
    name: "News Pro Pack",
    version: "10.17.4",
    description: "Adds saved topics, why-it-matters summaries, route-ready priority boards, tighter briefings, and update history to News.",
    category: "panel-upgrade",
    targetPanels: ["News", "Brain"],
    commands: ["news briefing", "refresh news topics", "news why it matters", "route top story"],
    actionLabels: ["Build briefing", "Refresh topics", "Why it matters", "Route top story"],
    summaryMessage: "News Pro now powers saved topics, priority routing, and why-it-matters cards.",
    minCoreVersion: "10.17.4",
    updateChannel: "stable",
    updateFeedLabel: "FairlyOdd Stable",
    releaseNotes: ["Sharper morning briefing cards.", "Route top stories into Mission Control lanes.", "Adds plugin health + update surfacing inside the upgrade bay.", "Tracks update history and latest maintenance per pack."],
  },
  {
    id: "family-health-research-pack",
    name: "Family Health Research Pack",
    version: "10.17.4",
    description: "Adds trusted-source research mode, doctor-question builder, appointment prep sheets, research summaries, and better maintenance history to Family Health.",
    category: "assistant-pack",
    targetPanels: ["FamilyHealth", "Brain"],
    permissions: [
      { id: "trusted_sources", label: "Trusted sources", description: "Allows Family Health to open Johns Hopkins, MedlinePlus, Mayo Clinic, Cleveland Clinic, and PubMed helper lanes." },
      { id: "research_fetch", label: "Research fetch", description: "Allows Family Health to fetch remote research summaries and literature results." },
    ],
    commands: ["build doctor questions", "research family health", "build prep sheet", "summarize research"],
    actionLabels: ["Build doctor questions", "Run trusted-source research", "Build prep sheet", "Summarize research"],
    summaryMessage: "Family Health Research Pack adds prep sheets, research summaries, and stronger care-brief support.",
    minCoreVersion: "10.17.4",
    updateChannel: "research",
    updateFeedLabel: "FairlyOdd Research",
    releaseNotes: ["Cleaner trusted-source permission prompts.", "Prep sheet and question builder actions are easier to route.", "Upgrade bay now surfaces health + version status.", "Mission Control can now see recent maintenance history for this pack."],
  },
  {
    id: "grocery-saver-pack",
    name: "Grocery Saver Pack",
    version: "10.17.4",
    description: "Adds cheap-week mode, store profiles, price-book estimates, coupon matching, store-plan guidance, and stronger pack maintenance tracking to Grocery Meals.",
    category: "panel-upgrade",
    targetPanels: ["GroceryMeals", "FamilyBudget"],
    commands: ["cheap week", "match coupons", "estimate basket", "build store plan"],
    actionLabels: ["Run cheap week", "Match coupons", "Estimate basket", "Build store plan"],
    summaryMessage: "Grocery Saver now powers price-book estimates, store plans, and tighter coupon matching.",
    installPrompt: "Install Grocery Saver?",
    minCoreVersion: "10.17.4",
    updateChannel: "stable",
    updateFeedLabel: "FairlyOdd Stable",
    dependencies: ["family-health-research-pack"],
    releaseNotes: ["Store-plan actions are promoted into Brain + AssistantDock.", "Coupon matching and basket estimate flow now show clearer pack health.", "Upgrade bay can now flag version drift and stale packs.", "Latest maintenance history is now visible in the plugin bay and Brain."],
  },

  {
    id: "homie-room-pack-cyber-noir",
    name: "Homie Room Pack: Cyber Noir",
    version: "10.18.0",
    description: "Unlocks the Cyber Noir furniture theme for Homie House, plus tighter neon ambience and darker room tones.",
    category: "assistant-pack",
    targetPanels: ["Homie", "Brain"],
    summaryMessage: "Cyber Noir unlocked for Homie House (furniture theme).",
    installPrompt: "Install Cyber Noir room pack?",
    minCoreVersion: "10.17.9",
    updateChannel: "stable",
    updateFeedLabel: "FairlyOdd Stable",
    releaseNotes: ["Adds Cyber Noir furniture theme.", "Keeps layouts/presets compatible.", "Works with snap grid + depth ordering."],
  },
  {
    id: "homie-room-pack-mission-ops",
    name: "Homie Room Pack: Mission Ops",
    version: "10.18.0",
    description: "Unlocks the Mission Ops furniture theme for Homie House: tactical glass, deeper blues, and ops-room lighting.",
    category: "assistant-pack",
    targetPanels: ["Homie", "Brain"],
    summaryMessage: "Mission Ops unlocked for Homie House (furniture theme).",
    installPrompt: "Install Mission Ops room pack?",
    minCoreVersion: "10.17.9",
    updateChannel: "stable",
    updateFeedLabel: "FairlyOdd Stable",
    releaseNotes: ["Adds Mission Ops furniture theme.", "Pairs well with Mission Control preset.", "Still supports layout editor + auto-save."],
  }
];

function isValidUpgradePackManifest(value: unknown): value is UpgradePackManifest {
  return !!value && typeof value === "object" && typeof (value as UpgradePackManifest).id === "string";
}

const AVAILABLE_UPGRADE_PACKS = UPGRADE_PACKS.filter(isValidUpgradePackManifest);

function compareVersions(a: string, b: string) {
  const pa = String(a || "0").split(".").map((part) => Number(part) || 0);
  const pb = String(b || "0").split(".").map((part) => Number(part) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let index = 0; index < len; index += 1) {
    const diff = (pa[index] || 0) - (pb[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function emitChange() {
  try {
    window.dispatchEvent(new CustomEvent(UPGRADE_PACKS_EVENT));
  } catch {}
}

function permissionDefaults(pack: UpgradePackManifest) {
  return Object.fromEntries((pack.permissions || []).map((perm) => [perm.id, false]));
}

export function getUpgradePackManifest(id: string) {
  return AVAILABLE_UPGRADE_PACKS.find((pack) => pack.id === id) || null;
}

export function getInstalledUpgradePacks() {
  const packs = loadJSON<InstalledUpgradePack[]>(UPGRADE_PACKS_KEY, []);
  if (!Array.isArray(packs)) return [];
  return packs.filter((pack) => !!pack && typeof pack.id === "string").map((pack) => ({
    id: pack.id,
    enabled: !!pack.enabled,
    version: String(pack.version || "0"),
    installedAt: Number(pack.installedAt || Date.now()),
    permissions: typeof pack.permissions === "object" && pack.permissions ? pack.permissions : {},
  }));
}

export function getUpgradePackHistory(packId?: string) {
  const all = loadJSON<UpgradePackHistoryEntry[]>(UPGRADE_PACK_HISTORY_KEY, []);
  const clean = Array.isArray(all) ? all.filter((entry) => !!entry && typeof entry.packId === "string") : [];
  return packId ? clean.filter((entry) => entry.packId === packId) : clean;
}

function appendUpgradePackHistory(entry: Omit<UpgradePackHistoryEntry, "id" | "at"> & Partial<Pick<UpgradePackHistoryEntry, "id" | "at">>) {
  const history = getUpgradePackHistory();
  const next: UpgradePackHistoryEntry = {
    id: entry.id || `${entry.packId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    at: entry.at || Date.now(),
    ...entry,
  } as UpgradePackHistoryEntry;
  saveJSON(UPGRADE_PACK_HISTORY_KEY, [next, ...history].slice(0, 120));
}

export function getLatestUpgradePackHistory(packId: string) {
  return getUpgradePackHistory(packId)[0] || null;
}

export function getUpgradePackHistorySummary() {
  const history = getUpgradePackHistory();
  return {
    total: history.length,
    success: history.filter((entry) => entry.status === "success").length,
    warn: history.filter((entry) => entry.status === "warn").length,
    lastAt: history[0]?.at || 0,
  };
}

export function getInstalledUpgradePack(id: string) {
  return getInstalledUpgradePacks().find((pack) => pack.id === id) || null;
}

export function isUpgradePackInstalled(id: string) {
  const pack = getInstalledUpgradePack(id);
  return !!pack?.enabled;
}

export function isUpgradePackPermissionGranted(packId: string, permissionId: string) {
  const pack = getInstalledUpgradePack(packId);
  return !!pack?.permissions?.[permissionId];
}

export function installUpgradePack(packId: string) {
  const manifest = getUpgradePackManifest(packId);
  if (!manifest) return false;
  const current = getInstalledUpgradePacks();
  const existing = current.find((pack) => pack.id === packId);
  const action = existing ? (compareVersions(existing.version, manifest.version) < 0 ? "update" : "install") : "install";
  const nextPack: InstalledUpgradePack = {
    id: packId,
    enabled: true,
    version: manifest.version,
    installedAt: existing?.installedAt || Date.now(),
    permissions: { ...permissionDefaults(manifest), ...(existing?.permissions || {}) },
  };
  saveJSON(UPGRADE_PACKS_KEY, [nextPack, ...current.filter((pack) => pack.id !== packId)]);
  appendUpgradePackHistory({
    packId,
    packName: manifest.name,
    action,
    status: action === "update" ? "success" : "info",
    detail: action === "update" ? `${manifest.name} updated from ${existing?.version || "unknown"} to ${manifest.version}.` : `${manifest.name} installed and enabled.`,
    fromVersion: existing?.version,
    toVersion: manifest.version,
    channel: manifest.updateChannel,
  });
  emitChange();
  return true;
}

export function uninstallUpgradePack(packId: string) {
  const existing = getInstalledUpgradePack(packId);
  const manifest = getUpgradePackManifest(packId);
  saveJSON(UPGRADE_PACKS_KEY, getInstalledUpgradePacks().filter((pack) => pack.id !== packId));
  if (existing || manifest) {
    appendUpgradePackHistory({
      packId,
      packName: manifest?.name || existing?.id || packId,
      action: "uninstall",
      status: "warn",
      detail: `${manifest?.name || packId} was removed from the upgrade bay.`,
      fromVersion: existing?.version,
      channel: manifest?.updateChannel,
    });
  }
  emitChange();
}

export function setUpgradePackEnabled(packId: string, enabled: boolean) {
  const current = getInstalledUpgradePacks();
  const target = current.find((pack) => pack.id === packId);
  const manifest = getUpgradePackManifest(packId);
  if (!target) return false;
  saveJSON(UPGRADE_PACKS_KEY, current.map((pack) => pack.id === packId ? { ...pack, enabled } : pack));
  appendUpgradePackHistory({
    packId,
    packName: manifest?.name || packId,
    action: enabled ? "enable" : "disable",
    status: enabled ? "info" : "warn",
    detail: `${manifest?.name || packId} ${enabled ? "enabled" : "disabled"}.`,
    fromVersion: target.version,
    toVersion: target.version,
    channel: manifest?.updateChannel,
  });
  emitChange();
  return true;
}

export function updateUpgradePack(packId: string) {
  return installUpgradePack(packId);
}

export function updateAllUpgradePacks(channel?: UpdateChannel) {
  let changed = false;
  let updatedCount = 0;
  for (const pack of AVAILABLE_UPGRADE_PACKS) {
    if (channel && pack.updateChannel !== channel) continue;
    const status = getUpgradePackStatus(pack.id);
    if (!status.installed || !status.outdated) continue;
    changed = installUpgradePack(pack.id) || changed;
    updatedCount += 1;
  }
  appendUpgradePackHistory({
    packId: channel ? `channel:${channel}` : "all-packs",
    packName: channel ? `${channel} channel` : "All packs",
    action: "update-all",
    status: updatedCount ? "success" : "info",
    detail: updatedCount ? `Upgrade bay refreshed ${updatedCount} pack${updatedCount === 1 ? "" : "s"}${channel ? ` on the ${channel} channel` : ""}.` : `Upgrade bay checked ${channel ? `${channel} channel ` : ""}packs and found nothing to update.`,
    channel,
  });
  emitChange();
  return changed;
}

export function repairUpgradePackDependencies(packId: string, seen = new Set<string>()) {
  if (seen.has(packId)) return false;
  seen.add(packId);
  const manifest = getUpgradePackManifest(packId);
  if (!manifest) return false;
  let changed = false;
  for (const depId of manifest.dependencies || []) {
    changed = installUpgradePack(depId) || changed;
    changed = setUpgradePackEnabled(depId, true) || changed;
    changed = repairUpgradePackDependencies(depId, seen) || changed;
  }
  changed = installUpgradePack(packId) || changed;
  changed = setUpgradePackEnabled(packId, true) || changed;
  appendUpgradePackHistory({
    packId,
    packName: manifest.name,
    action: "repair-dependencies",
    status: changed ? "success" : "info",
    detail: changed ? `${manifest.name} dependency repair completed.` : `${manifest.name} dependencies were already healthy.`,
    toVersion: manifest.version,
    channel: manifest.updateChannel,
  });
  emitChange();
  return changed;
}

export function grantUpgradePackPermission(packId: string, permissionId: string, granted = true) {
  const current = getInstalledUpgradePacks();
  const target = current.find((pack) => pack.id === packId);
  const manifest = getUpgradePackManifest(packId);
  if (!target) return false;
  saveJSON(UPGRADE_PACKS_KEY, current.map((pack) => pack.id === packId ? { ...pack, permissions: { ...(pack.permissions || {}), [permissionId]: granted } } : pack));
  appendUpgradePackHistory({
    packId,
    packName: manifest?.name || packId,
    action: "grant-permission",
    status: granted ? "success" : "warn",
    detail: `${granted ? "Granted" : "Revoked"} permission ${permissionId} for ${manifest?.name || packId}.`,
    toVersion: target.version,
    channel: manifest?.updateChannel,
  });
  emitChange();
  return true;
}

export function grantAllUpgradePackPermissions(packId: string) {
  const manifest = getUpgradePackManifest(packId);
  if (!manifest) return false;
  installUpgradePack(packId);
  let changed = false;
  for (const permission of manifest.permissions || []) {
    changed = grantUpgradePackPermission(packId, permission.id, true) || changed;
  }
  emitChange();
  return changed;
}

export function getUpgradePackStatus(id: string) {
  const manifest = getUpgradePackManifest(id);
  const installed = getInstalledUpgradePack(id);
  const missingPermissions = (manifest?.permissions || []).filter((perm) => !installed?.permissions?.[perm.id]);
  const dependencyIssues = (manifest?.dependencies || []).filter((depId) => !isUpgradePackInstalled(depId));
  const outdated = !!installed && !!manifest && compareVersions(installed.version, manifest.version) < 0;
  const healthy = !!installed?.enabled && !missingPermissions.length && !dependencyIssues.length && !outdated;
  return {
    manifest,
    installed,
    enabled: !!installed?.enabled,
    missingPermissions,
    dependencyIssues,
    outdated,
    healthy,
  };
}

export function getUpgradePackSummaries() {
  return AVAILABLE_UPGRADE_PACKS.map((pack) => {
    const status = getUpgradePackStatus(pack.id);
    return {
      ...pack,
      enabled: status.enabled,
      installed: !!status.installed,
      installedVersion: status.installed?.version || "",
      missingPermissions: status.missingPermissions,
      dependencyIssues: status.dependencyIssues,
      outdated: status.outdated,
      healthy: status.healthy,
      updateChannel: pack.updateChannel || "stable",
      updateFeedLabel: pack.updateFeedLabel || "FairlyOdd Stable",
      latestHistory: getLatestUpgradePackHistory(pack.id),
    };
  });
}

export function getUpgradeBayStats() {
  const packs = getUpgradePackSummaries();
  return {
    total: packs.length,
    installed: packs.filter((pack) => pack.installed).length,
    available: packs.filter((pack) => !pack.installed).length,
    updates: packs.filter((pack) => pack.outdated).length,
    permissionIssues: packs.filter((pack) => pack.missingPermissions.length).length,
    dependencyIssues: packs.filter((pack) => pack.dependencyIssues.length).length,
    healthy: packs.filter((pack) => pack.healthy).length,
    stable: packs.filter((pack) => pack.updateChannel === "stable").length,
    research: packs.filter((pack) => pack.updateChannel === "research").length,
    preview: packs.filter((pack) => pack.updateChannel === "preview").length,
    history: getUpgradePackHistorySummary(),
  };
}

export function getHomieUpgradeMessages() {
  const statuses = getUpgradePackSummaries();
  const messages: string[] = [];
  const available = statuses.filter((pack) => !pack.installed).length;
  if (available) messages.push(`You have ${available} upgrade pack${available === 1 ? "" : "s"} available.`);
  const news = statuses.find((pack) => pack.id === "news-pro-pack");
  if (news?.enabled) messages.push(news.outdated ? "News Pro has an update waiting in the upgrade bay." : "News Pro added deeper briefings, why-it-matters notes, and route cards.");
  const health = statuses.find((pack) => pack.id === "family-health-research-pack");
  if (health?.installed && health.missingPermissions.length) messages.push("Family Health Research Pack needs source permissions.");
  const grocery = statuses.find((pack) => pack.id === "grocery-saver-pack");
  if (!grocery?.installed) messages.push("Install Grocery Saver?");
  const updates = statuses.filter((pack) => pack.outdated).length;
  if (updates) messages.push(`${updates} upgrade pack${updates === 1 ? " has" : "s have"} updates ready.`);
  return messages;
}

export function getPluginCommandSuggestions() {
  const cmds = new Set<string>();
  for (const pack of getUpgradePackSummaries()) {
    if (!pack.enabled) continue;
    for (const cmd of pack.commands || []) cmds.add(cmd);
  }
  return Array.from(cmds);
}

function packActionSet(pack: UpgradePackManifest): UpgradeSurfaceAction[] {
  if (pack.id === "news-pro-pack") {
    return [
      { id: `${pack.id}:briefing`, label: "Build briefing", kind: "command", commandText: "news briefing", speakText: "Running the News Pro briefing.", tone: "good" },
      { id: `${pack.id}:topics`, label: "Refresh topics", kind: "command", commandText: "refresh news topics", speakText: "Refreshing watched news topics." },
      { id: `${pack.id}:matters`, label: "Why it matters", kind: "command", commandText: "news why it matters" },
      { id: `${pack.id}:route`, label: "Route top story", kind: "command", commandText: "route top story" },
    ];
  }
  if (pack.id === "family-health-research-pack") {
    return [
      { id: `${pack.id}:questions`, label: "Doctor questions", kind: "command", commandText: "build doctor questions", speakText: "Building a doctor-question list.", tone: "good" },
      { id: `${pack.id}:research`, label: "Run research", kind: "command", commandText: "research family health", speakText: "Running trusted-source research." },
      { id: `${pack.id}:prep`, label: "Build prep sheet", kind: "command", commandText: "build prep sheet" },
      { id: `${pack.id}:summary`, label: "Summarize research", kind: "command", commandText: "summarize research" },
    ];
  }
  if (pack.id === "grocery-saver-pack") {
    return [
      { id: `${pack.id}:cheap-week`, label: "Cheap week", kind: "command", commandText: "cheap week", speakText: "Building a cheap week plan.", tone: "good" },
      { id: `${pack.id}:coupons`, label: "Match coupons", kind: "command", commandText: "match coupons", speakText: "Matching coupons to the grocery plan." },
      { id: `${pack.id}:estimate`, label: "Estimate basket", kind: "command", commandText: "estimate basket" },
      { id: `${pack.id}:stores`, label: "Build store plan", kind: "command", commandText: "build store plan" },
    ];
  }
  return [];
}

function createInstallCard(pack: UpgradePackManifest, target: "assistant" | "brain", panelIds?: string[]): UpgradeSurfaceCard {
  return {
    id: `${pack.id}:${target}:install`,
    sourcePackId: pack.id,
    target,
    panelIds,
    eyebrow: "Upgrade pack available",
    title: `${pack.name} is ready`,
    body: pack.installPrompt || pack.description,
    tone: "warn",
    actions: [
      { id: `${pack.id}:install`, label: pack.installPrompt || `Install ${pack.name}`, kind: "install-pack", tone: "good" },
      ...(pack.targetPanels[0] ? [{ id: `${pack.id}:nav`, label: `Open ${pack.targetPanels[0]}`, kind: "navigate" as const, panelId: pack.targetPanels[0] }] : []),
    ],
  };
}

function createPermissionCard(pack: UpgradePackManifest, target: "assistant" | "brain", panelIds?: string[], missingCount?: number): UpgradeSurfaceCard {
  return {
    id: `${pack.id}:${target}:permissions`,
    sourcePackId: pack.id,
    target,
    panelIds,
    eyebrow: "Permissions needed",
    title: `${pack.name} needs access`,
    body: `${missingCount || 0} source permission${missingCount === 1 ? "" : "s"} still need approval before the copilot can use this pack fully.`,
    tone: "warn",
    actions: [
      { id: `${pack.id}:grant`, label: `Grant ${pack.name} permissions`, kind: "grant-permissions", tone: "good" },
      ...(pack.targetPanels[0] ? [{ id: `${pack.id}:nav`, label: `Open ${pack.targetPanels[0]}`, kind: "navigate" as const, panelId: pack.targetPanels[0] }] : []),
    ],
  };
}

function createDependencyCard(pack: UpgradePackManifest, target: "assistant" | "brain", panelIds?: string[], dependencyIds?: string[]): UpgradeSurfaceCard {
  return {
    id: `${pack.id}:${target}:dependencies`,
    sourcePackId: pack.id,
    target,
    panelIds,
    eyebrow: "Dependency repair",
    title: `${pack.name} is waiting on another pack`,
    body: `Repair this pack by installing or re-enabling: ${(dependencyIds || []).join(", ") || "required dependencies"}.`,
    tone: "warn",
    actions: [
      { id: `${pack.id}:repair`, label: `Repair ${pack.name}`, kind: "repair-dependencies", tone: "good" },
      ...(pack.targetPanels[0] ? [{ id: `${pack.id}:nav`, label: `Open ${pack.targetPanels[0]}`, kind: "navigate" as const, panelId: pack.targetPanels[0] }] : []),
    ],
  };
}

function createActiveCard(pack: UpgradePackManifest, target: "assistant" | "brain", panelIds?: string[]): UpgradeSurfaceCard {
  return {
    id: `${pack.id}:${target}:active`,
    sourcePackId: pack.id,
    target,
    panelIds,
    eyebrow: target === "brain" ? "Mission Control upgrade" : "Copilot upgrade",
    title: `${pack.name} is active`,
    body: pack.summaryMessage,
    tone: "good",
    actions: packActionSet(pack),
  };
}

function createUpdateCard(pack: UpgradePackManifest, target: "assistant" | "brain", panelIds?: string[]): UpgradeSurfaceCard {
  return {
    id: `${pack.id}:${target}:update`,
    sourcePackId: pack.id,
    target,
    panelIds,
    eyebrow: "Update ready",
    title: `${pack.name} can be updated`,
    body: `Installed ${getInstalledUpgradePack(pack.id)?.version || "unknown"} → ${pack.version}. This refresh keeps the pack aligned with the latest FairlyOdd shell and Mission Control hooks.`,
    tone: "warn",
    actions: [
      { id: `${pack.id}:install`, label: `Update ${pack.name}`, kind: "install-pack", tone: "good" },
      ...(pack.targetPanels[0] ? [{ id: `${pack.id}:nav`, label: `Open ${pack.targetPanels[0]}`, kind: "navigate" as const, panelId: pack.targetPanels[0] }] : []),
    ],
  };
}

function createUpdateWidget(pack: UpgradePackManifest, panelId: string): UpgradePanelWidget {
  return {
    id: `${pack.id}:${panelId}:widget-update`,
    sourcePackId: pack.id,
    panelId,
    eyebrow: "Update ready",
    title: `${pack.name} update available`,
    body: `Installed ${getInstalledUpgradePack(pack.id)?.version || "unknown"} → ${pack.version}. Update the pack to keep the panel widget aligned with the latest shell polish and action hooks.`,
    tone: "warn",
    actions: [
      { id: `${pack.id}:install`, label: `Update ${pack.name}`, kind: "install-pack", tone: "good" },
    ],
  };
}

function createPanelWidget(pack: UpgradePackManifest, panelId: string): UpgradePanelWidget {
  const status = getUpgradePackStatus(pack.id);
  if (!status.installed) {
    return {
      id: `${pack.id}:${panelId}:widget-install`,
      sourcePackId: pack.id,
      panelId,
      eyebrow: "Upgrade pack",
      title: `${pack.name} available`,
      body: pack.installPrompt || pack.description,
      tone: "warn",
      actions: [
        { id: `${pack.id}:install`, label: pack.installPrompt || `Install ${pack.name}`, kind: "install-pack", tone: "good" },
      ],
    };
  }
  if (status.missingPermissions.length) {
    return {
      id: `${pack.id}:${panelId}:widget-perms`,
      sourcePackId: pack.id,
      panelId,
      eyebrow: "Permissions",
      title: `${pack.name} needs permissions`,
      body: `Grant the remaining ${status.missingPermissions.length} permission${status.missingPermissions.length === 1 ? "" : "s"} so this widget can use trusted sources or research helpers.`,
      tone: "warn",
      actions: [
        { id: `${pack.id}:grant`, label: `Grant ${pack.name} permissions`, kind: "grant-permissions", tone: "good" },
      ],
    };
  }
  if (status.dependencyIssues.length) {
    return {
      id: `${pack.id}:${panelId}:widget-deps`,
      sourcePackId: pack.id,
      panelId,
      eyebrow: "Dependencies",
      title: `${pack.name} is waiting on another pack`,
      body: `Install or re-enable: ${status.dependencyIssues.join(", ")}.`,
      tone: "warn",
      actions: [
        { id: `${pack.id}:repair`, label: `Repair ${pack.name}`, kind: "repair-dependencies", tone: "good" },
      ],
    };
  }
  if (status.outdated) return createUpdateWidget(pack, panelId);
  const bodyMap: Record<string, string> = {
    "news-pro-pack": "Saved topics, why-it-matters summaries, and route-ready briefing cards are active here.",
    "family-health-research-pack": "Prep sheets, trusted-source summaries, and doctor-question flows are active here.",
    "grocery-saver-pack": "Price-book estimates, store plans, cheap-week mode, and coupon matching are live here.",
  };
  return {
    id: `${pack.id}:${panelId}:widget-active`,
    sourcePackId: pack.id,
    panelId,
    eyebrow: "Plugin widget",
    title: `${pack.name}`,
    body: bodyMap[pack.id] || pack.summaryMessage,
    tone: "good",
    compact: true,
    actions: packActionSet(pack),
  };
}

function shouldShowForPanel(pack: UpgradePackManifest, panelId: string) {
  return pack.targetPanels.includes(panelId) || panelId === "Brain";
}

export function getInjectedAssistantCards(panelId: string) {
  const cards: UpgradeSurfaceCard[] = [];
  for (const pack of AVAILABLE_UPGRADE_PACKS) {
    if (!shouldShowForPanel(pack, panelId)) continue;
    const status = getUpgradePackStatus(pack.id);
    if (!status.installed) {
      cards.push(createInstallCard(pack, "assistant", [panelId]));
      continue;
    }
    if (status.missingPermissions.length) {
      cards.push(createPermissionCard(pack, "assistant", [panelId], status.missingPermissions.length));
      continue;
    }
    if (status.dependencyIssues.length) {
      cards.push(createDependencyCard(pack, "assistant", [panelId], status.dependencyIssues));
      continue;
    }
    if (status.outdated) {
      cards.push(createUpdateCard(pack, "assistant", [panelId]));
      continue;
    }
    if (status.enabled) cards.push(createActiveCard(pack, "assistant", [panelId]));
  }
  return cards;
}

export function getInjectedBrainCards() {
  const cards: UpgradeSurfaceCard[] = [];
  for (const pack of AVAILABLE_UPGRADE_PACKS) {
    const status = getUpgradePackStatus(pack.id);
    if (!status.installed) {
      cards.push(createInstallCard(pack, "brain", ["Brain"]));
      continue;
    }
    if (status.missingPermissions.length) {
      cards.push(createPermissionCard(pack, "brain", ["Brain"], status.missingPermissions.length));
      continue;
    }
    if (status.dependencyIssues.length) {
      cards.push(createDependencyCard(pack, "brain", ["Brain"], status.dependencyIssues));
      continue;
    }
    if (status.outdated) {
      cards.push(createUpdateCard(pack, "brain", ["Brain"]));
      continue;
    }
    if (status.enabled) cards.push(createActiveCard(pack, "brain", ["Brain"]));
  }
  return cards;
}

export function getInjectedPanelWidgets(panelId: string) {
  const widgets: UpgradePanelWidget[] = [];
  for (const pack of AVAILABLE_UPGRADE_PACKS) {
    if (!pack.targetPanels.includes(panelId)) continue;
    widgets.push(createPanelWidget(pack, panelId));
  }
  return widgets;
}
