import {
  BRAIN_INBOX_KEY,
  ACTION_CHAINS,
  QUICK_ACTIONS,
  buildDailyDigest,
  buildMorningDigest,
  buildOperatorFeed,
  buildPanelHealth,
  getPanelMeta,
  logActivity,
  normalizePanelId,
  queuePanelAction,
  runQuickAction,
} from "./brain";
import { oddApi } from "./odd";
import {
  getUpgradePackStatus,
  getUpgradePackSummaries,
  grantUpgradePackPermission,
  installUpgradePack,
  isUpgradePackInstalled,
  repairUpgradePackDependencies,
  updateAllUpgradePacks,
} from "./plugins";

export type CommandExecArgs = {
  text: string;
  activePanelId: string;
  onNavigate: (id: string) => void;
  onOpenHowTo?: () => void;
  onStatus?: (text: string) => void;
};

const BASE_COMMAND_SUGGESTIONS = [
  "open homie companion",
  "morning digest",
  "daily digest",
  "open mission control",
  "run next action",
  "panel health",
  "operator feed",
  "open news",
  "refresh news",
  "open family health",
  "research family health",
  "open grocery meals",
  "build grocery list",
  "open coupon lane",
  "run trading chain",
  "run budget chain",
  "run grow chain",
  "undo last ai action",
];

export const COMMAND_SUGGESTIONS = [
  ...BASE_COMMAND_SUGGESTIONS,
  "news briefing",
  "refresh news topics",
  "news why it matters",
  "route top story",
  "build doctor questions",
  "build prep sheet",
  "summarize research",
  "cheap week",
  "match coupons",
  "estimate basket",
  "build store plan",
  "update all packs",
  "update stable packs",
  "repair plugin dependencies",
  "repair grocery saver dependencies",
  "probe external voice",
  "voice bridge health",
  "use external voice",
  "open bridge folder",
  "install bridge deps",
  "start external bridge",
  "copy bridge command",
];

function resolvePanelFromText(text: string) {
  const cleaned = text.trim().toLowerCase();
  const candidates = ["OddBrain", "Homie", "DevEngine", "Autopilot", "Builder", "Plugins", "Money", "FamilyBudget", "Brain", "HappyHealthy", "Cannabis", "Trading", "Grow", "Mining", "CryptoGames", "Cameras", "OptionsSaaS", "Preferences", "Security", "News", "FamilyHealth", "GroceryMeals", "Entertainment", "Books"];
  for (const id of candidates) {
    const meta = getPanelMeta(id);
    const keys = [id.toLowerCase(), meta.title.toLowerCase(), meta.title.replace(/\s+/g, "").toLowerCase()];
    if (keys.some((k) => cleaned.includes(k))) return id;
  }
  if (cleaned.includes("budget")) return "FamilyBudget";
  if (cleaned.includes("games") || cleaned.includes("zbd")) return "CryptoGames";
  if (cleaned.includes("saas") || cleaned.includes("options")) return "OptionsSaaS";
  if (cleaned.includes("family health") || cleaned.includes("medical")) return "FamilyHealth";
  if (cleaned.includes("grocery") || cleaned.includes("meal")) return "GroceryMeals";
  return "";
}

function sendToBrain(text: string, onNavigate: (id: string) => void) {
  try {
    localStorage.setItem(BRAIN_INBOX_KEY, JSON.stringify({ text, ts: Date.now() }));
  } catch {}
  onNavigate("Brain");
}

function runDirectQuickAction(actionId: string, args: CommandExecArgs) {
  const result = runQuickAction(actionId);
  if (result.panelId) args.onNavigate(result.panelId);
  args.onStatus?.(result.message);
  logActivity({ kind: "command", panelId: result.panelId || args.activePanelId, title: `Ran ${actionId}`, body: result.message });
  return result;
}

function installPackCommand(args: CommandExecArgs, packId: string, message: string) {
  installUpgradePack(packId);
  args.onStatus?.(message);
  return { ok: true, message, panelId: "Plugins" };
}

function queuePanelCommand(args: CommandExecArgs, panelId: string, actionId: string, message: string) {
  queuePanelAction(panelId, actionId);
  args.onNavigate(panelId);
  args.onStatus?.(message);
  return { ok: true, message, panelId };
}

export function executeCommand(args: CommandExecArgs) {
  const text = args.text.trim();
  if (!text) return { ok: false, message: "No command provided." };
  const lower = text.toLowerCase();

  if (lower === "digest" || lower.includes("daily digest")) {
    const digest = buildDailyDigest();
    sendToBrain(`Use this digest as the starting context:\n\n${digest}`, args.onNavigate);
    logActivity({ kind: "command", panelId: args.activePanelId, title: "Ran digest", body: text });
    args.onStatus?.("Opened Brain with the latest digest.");
    return { ok: true, message: "Opened Brain with the latest digest.", panelId: "Brain" };
  }
  if (lower.includes("morning digest")) {
    const digest = buildMorningDigest();
    sendToBrain(`Use this morning digest as the starting context:\n\n${digest}`, args.onNavigate);
    args.onStatus?.("Opened Brain with the morning digest.");
    return { ok: true, message: "Opened Brain with the morning digest.", panelId: "Brain" };
  }
  if (lower.includes("panel health")) {
    const health = buildPanelHealth().slice(0, 6).map((item) => `${item.title}: ${item.score}/100 • ${item.headline}`).join("\n");
    sendToBrain(`Summarize this panel-health snapshot and tell me what matters most:\n\n${health}`, args.onNavigate);
    args.onStatus?.("Sent panel health to Brain.");
    return { ok: true, message: "Sent panel health to Brain.", panelId: "Brain" };
  }
  if (lower.includes("operator feed")) {
    const feed = buildOperatorFeed(8).map((item) => `${getPanelMeta(item.panelId).title}: ${item.title} — ${item.body}`).join("\n");
    sendToBrain(`Summarize this AI operator feed:\n\n${feed}`, args.onNavigate);
    args.onStatus?.("Sent the operator feed to Brain.");
    return { ok: true, message: "Sent the operator feed to Brain.", panelId: "Brain" };
  }

  if (lower.includes("install grocery saver")) return installPackCommand(args, "grocery-saver-pack", "Installed Grocery Saver Pack.");
  if (lower.includes("install news pro")) return installPackCommand(args, "news-pro-pack", "Installed News Pro Pack.");
  if (lower.includes("install family health research")) return installPackCommand(args, "family-health-research-pack", "Installed Family Health Research Pack.");
  if (lower.includes("grant family health permissions") || lower.includes("grant source permissions")) {
    installUpgradePack("family-health-research-pack");
    const status = getUpgradePackStatus("family-health-research-pack");
    status.missingPermissions.forEach((perm) => grantUpgradePackPermission("family-health-research-pack", perm.id, true));
    const message = "Granted Family Health Research Pack permissions.";
    args.onStatus?.(message);
    return { ok: true, message, panelId: "Plugins" };
  }

  if (lower.includes("news briefing")) {
    if (!isUpgradePackInstalled("news-pro-pack")) return { ok: false, message: "Install News Pro Pack first.", panelId: "Plugins" };
    return queuePanelCommand(args, "News", "news:briefing", "Queued the News briefing builder.");
  }
  if (lower.includes("refresh news topics")) {
    if (!isUpgradePackInstalled("news-pro-pack")) return { ok: false, message: "Install News Pro Pack first.", panelId: "Plugins" };
    return queuePanelCommand(args, "News", "news:watch-topics", "Queued News topic refresh.");
  }
  if (lower.includes("news why it matters") || lower.includes("why it matters")) {
    if (!isUpgradePackInstalled("news-pro-pack")) return { ok: false, message: "Install News Pro Pack first.", panelId: "Plugins" };
    return queuePanelCommand(args, "News", "news:why-it-matters", "Queued a why-it-matters summary for News.");
  }
  if (lower.includes("route top story")) {
    if (!isUpgradePackInstalled("news-pro-pack")) return { ok: false, message: "Install News Pro Pack first.", panelId: "Plugins" };
    return queuePanelCommand(args, "News", "news:route-top-story", "Queued route-ready guidance for the top story.");
  }
  if (lower.includes("build doctor questions")) {
    if (!isUpgradePackInstalled("family-health-research-pack")) return { ok: false, message: "Install Family Health Research Pack first.", panelId: "Plugins" };
    return queuePanelCommand(args, "FamilyHealth", "family-health:build-questions", "Queued doctor-question builder.");
  }
  if (lower.includes("research family health") || lower.includes("medical research")) {
    if (!isUpgradePackInstalled("family-health-research-pack")) return { ok: false, message: "Install Family Health Research Pack first.", panelId: "Plugins" };
    return queuePanelCommand(args, "FamilyHealth", "family-health:research", "Queued family-health research.");
  }
  if (lower.includes("build prep sheet") || lower.includes("prep sheet")) {
    if (!isUpgradePackInstalled("family-health-research-pack")) return { ok: false, message: "Install Family Health Research Pack first.", panelId: "Plugins" };
    return queuePanelCommand(args, "FamilyHealth", "family-health:build-prep", "Queued appointment prep sheet builder.");
  }
  if (lower.includes("summarize research")) {
    if (!isUpgradePackInstalled("family-health-research-pack")) return { ok: false, message: "Install Family Health Research Pack first.", panelId: "Plugins" };
    return queuePanelCommand(args, "FamilyHealth", "family-health:summarize-research", "Queued a research summary for the active family member.");
  }
  if (lower.includes("cheap week")) {
    if (!isUpgradePackInstalled("grocery-saver-pack")) return { ok: false, message: "Install Grocery Saver Pack first.", panelId: "Plugins" };
    return queuePanelCommand(args, "GroceryMeals", "grocery:cheap-week", "Queued cheap-week planner.");
  }
  if (lower.includes("match coupons")) {
    if (!isUpgradePackInstalled("grocery-saver-pack")) return { ok: false, message: "Install Grocery Saver Pack first.", panelId: "Plugins" };
    return queuePanelCommand(args, "GroceryMeals", "grocery:match-coupons", "Queued coupon matching.");
  }
  if (lower.includes("estimate basket")) {
    if (!isUpgradePackInstalled("grocery-saver-pack")) return { ok: false, message: "Install Grocery Saver Pack first.", panelId: "Plugins" };
    return queuePanelCommand(args, "GroceryMeals", "grocery:estimate-basket", "Queued a basket estimate refresh.");
  }
  if (lower.includes("build store plan") || lower.includes("store plan")) {
    if (!isUpgradePackInstalled("grocery-saver-pack")) return { ok: false, message: "Install Grocery Saver Pack first.", panelId: "Plugins" };
    return queuePanelCommand(args, "GroceryMeals", "grocery:store-plan", "Queued a store plan refresh.");
  }


  if (lower.includes("probe local voice") || lower.includes("check local voice") || lower.includes("on-device voice") || lower.includes("install local voice pack") || lower.includes("install offline voice") || lower.includes("download local voice")) {
    const message = "Browser on-device voice stays disabled in this runtime. Use the external/local voice bridge instead.";
    args.onStatus?.(message);
    return { ok: false, message, panelId: "Homie" };
  }

  if (lower.includes("probe external voice") || lower.includes("voice bridge health") || lower.includes("check external voice")) {
    try {
      window.dispatchEvent(new CustomEvent("oddengine:homie-voice-action", { detail: { action: "probe-external", source: "commandbar" } }));
    } catch {}
    const message = "Asked Homie to probe the external/local voice bridge.";
    args.onStatus?.(message);
    return { ok: true, message, panelId: "Homie" };
  }
  if (lower.includes("use external voice") || lower.includes("external voice mode")) {
    const message = "Set Homie voice mode to External/local HTTP in Preferences to route voice commands through your local bridge.";
    args.onStatus?.(message);
    return { ok: true, message, panelId: "Preferences" };
  }
  if (lower.includes("open bridge folder") || lower.includes("external bridge folder") || lower.includes("open voice bridge")) {
    try {
      window.dispatchEvent(new CustomEvent("oddengine:bridge-assistant", { detail: { action: "open-folder", source: "commandbar" } }));
    } catch {}
    const message = "Asked Preferences to open the external voice bridge folder.";
    args.onStatus?.(message);
    return { ok: true, message, panelId: "Preferences" };
  }
  if (lower.includes("install bridge deps") || lower.includes("install voice bridge deps")) {
    try {
      window.dispatchEvent(new CustomEvent("oddengine:bridge-assistant", { detail: { action: "install-deps", source: "commandbar" } }));
    } catch {}
    const message = "Asked Preferences to install the external bridge dependencies.";
    args.onStatus?.(message);
    return { ok: true, message, panelId: "Preferences" };
  }
  if (lower.includes("start external bridge") || lower.includes("launch external bridge") || lower.includes("run voice bridge")) {
    try {
      window.dispatchEvent(new CustomEvent("oddengine:bridge-assistant", { detail: { action: "launch-bridge", source: "commandbar" } }));
    } catch {}
    const message = "Asked Preferences to start the external voice bridge.";
    args.onStatus?.(message);
    return { ok: true, message, panelId: "Preferences" };
  }
  if (lower.includes("copy bridge command") || lower.includes("copy voice bridge command")) {
    try {
      window.dispatchEvent(new CustomEvent("oddengine:bridge-assistant", { detail: { action: "copy-command", source: "commandbar" } }));
    } catch {}
    const message = "Asked Preferences to copy the external bridge launch command.";
    args.onStatus?.(message);
    return { ok: true, message, panelId: "Preferences" };
  }

  if (lower.includes("update all packs") || lower.includes("update plugins")) {
    updateAllUpgradePacks();
    const message = "Ran update checks for all installed upgrade packs.";
    args.onStatus?.(message);
    return { ok: true, message, panelId: "Plugins" };
  }
  if (lower.includes("update stable packs") || lower.includes("update stable channel")) {
    updateAllUpgradePacks("stable");
    const message = "Ran update checks for stable-channel packs.";
    args.onStatus?.(message);
    return { ok: true, message, panelId: "Plugins" };
  }
  if (lower.includes("repair plugin dependencies") || lower.includes("repair pack dependencies")) {
    const issues = getUpgradePackSummaries().filter((pack) => pack.dependencyIssues?.length);
    issues.forEach((pack) => repairUpgradePackDependencies(pack.id));
    const message = issues.length ? `Repaired dependency flows for ${issues.length} pack${issues.length === 1 ? "" : "s"}.` : "No plugin dependency issues were detected.";
    args.onStatus?.(message);
    return { ok: true, message, panelId: "Plugins" };
  }
  if (lower.includes("repair grocery saver dependencies") || lower.includes("repair grocery dependencies")) {
    repairUpgradePackDependencies("grocery-saver-pack");
    const message = "Ran dependency repair for Grocery Saver Pack.";
    args.onStatus?.(message);
    return { ok: true, message, panelId: "Plugins" };
  }

  if (lower.includes("open homie companion") || lower.includes("launch homie companion") || lower.includes("pop out homie")) {
    oddApi().openWindow?.({
      title: "Homie Buddy",
      query: { buddy: "1" },
      width: 420,
      height: 720,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      skipTaskbar: false,
      resizable: true,
    });
    const message = "Opened the Homie companion window.";
    args.onStatus?.(message);
    return { ok: true, message, panelId: "Homie" };
  }

  if (lower.includes("open mission control")) return runDirectQuickAction("panel:brain", args);
  if (lower.includes("run next action")) return runDirectQuickAction("brain:run-next-queue", args);
  if (lower.includes("focus plan") || lower === "focus") return runDirectQuickAction("brain:focus-plan", args);
  if (lower.includes("pin digest") || lower.includes("save digest")) return runDirectQuickAction("brain:pin-digest", args);
  if (lower.includes("clear activity")) return runDirectQuickAction("brain:clear-activity", args);
  if (lower.includes("undo last ai action") || lower === "undo" || lower.includes("rollback last ai action")) return runDirectQuickAction("brain:undo-last-action", args);
  if (lower.includes("run avalanche payoff") || lower.includes("avalanche payoff")) return runDirectQuickAction("budget:payoff-avalanche", args);
  if (lower.includes("run snowball payoff") || lower.includes("snowball payoff")) return runDirectQuickAction("budget:payoff-snowball", args);
  if (lower.includes("test budget sync") || lower.includes("budget sync test")) return runDirectQuickAction("budget:test-sync", args);
  if (lower.includes("fund budget goals") || lower.includes("fund goals")) return runDirectQuickAction("budget:fund-goals", args);
  if (lower.includes("budget transaction")) return runDirectQuickAction("budget:transactions", args);
  if (lower.includes("run trading chain") || lower.includes("one click trade") || lower.includes("safe trade chain")) return runDirectQuickAction("trading:chain-safe-focus-plan", args);
  if (lower.includes("run budget chain") || lower.includes("budget chain")) return runDirectQuickAction("budget:chain-payoff-goals-report", args);
  if (lower.includes("run grow chain") || lower.includes("grow chain")) return runDirectQuickAction("grow:chain-targets-reading-profile", args);
  if (lower.includes("apply safer trading setup") || lower.includes("safer trading setup")) return runDirectQuickAction("trading:safer-setup", args);
  if (lower.includes("focus best contract") || lower.includes("best contract")) return runDirectQuickAction("trading:focus-best", args);
  if (lower.includes("build trade plan") || lower.includes("trade plan")) return runDirectQuickAction("trading:build-plan", args);
  if (lower.includes("apply grow targets") || lower.includes("grow targets")) return runDirectQuickAction("grow:apply-targets", args);
  if (lower.includes("save grow reading") || lower.includes("log grow reading")) return runDirectQuickAction("grow:save-reading", args);
  if (lower.includes("ac infinity preset") || lower.includes("grow ac infinity")) return runDirectQuickAction("grow:ac-infinity-preset", args);
  if (lower.includes("lock security") || lower.includes("lockdown") || lower.includes("ip lock on")) return runDirectQuickAction("security:lockdown", args);
  if (lower.includes("operator mode")) return runDirectQuickAction("prefs:operator-tight", args);
  if (lower.includes("coach mode") || lower.includes("deep mode")) return runDirectQuickAction("prefs:coach-deep", args);
  if (lower.includes("open news")) return runDirectQuickAction("panel:news", args);
  if (lower.includes("refresh news")) return runDirectQuickAction("news:refresh", args);
  if (lower.includes("open family health") || lower.includes("open medical")) return runDirectQuickAction("panel:family-health", args);
  if (lower.includes("open grocery") || lower.includes("open meals")) return runDirectQuickAction("panel:grocery", args);
  if (lower.includes("build grocery list")) return runDirectQuickAction("grocery:build-list", args);
  if (lower.includes("coupon lane") || lower.includes("open coupon")) return runDirectQuickAction("grocery:coupon-lane", args);

  if (lower.startsWith("open ") || lower.startsWith("go to ") || lower.startsWith("switch to ")) {
    const panel = resolvePanelFromText(lower);
    if (panel) {
      args.onNavigate(panel);
      logActivity({ kind: "command", panelId: panel, title: `Opened ${panel}`, body: text });
      const message = `Opened ${getPanelMeta(panel).title}.`;
      args.onStatus?.(message);
      return { ok: true, message, panelId: panel };
    }
  }

  if (lower.startsWith("help") || lower.includes("how to")) {
    const panel = resolvePanelFromText(lower) || normalizePanelId(args.activePanelId);
    args.onNavigate(panel);
    args.onOpenHowTo?.();
    logActivity({ kind: "command", panelId: panel, title: `Opened help for ${panel}`, body: text });
    const message = `Opened how-to for ${getPanelMeta(panel).title}.`;
    args.onStatus?.(message);
    return { ok: true, message, panelId: panel };
  }

  if (lower === "homie" || lower.startsWith("ask homie")) {
    args.onNavigate("Homie");
    logActivity({ kind: "command", panelId: "Homie", title: "Opened Homie", body: text });
    args.onStatus?.("Opened Homie.");
    return { ok: true, message: "Opened Homie.", panelId: "Homie" };
  }

  const registryMatch = [...ACTION_CHAINS, ...QUICK_ACTIONS].find((action) => lower === action.label.toLowerCase() || lower.includes(action.label.toLowerCase()));
  if (registryMatch) return runDirectQuickAction(registryMatch.id, args);

  sendToBrain(text, args.onNavigate);
  logActivity({ kind: "command", panelId: args.activePanelId, title: "Sent command to Brain", body: text });
  args.onStatus?.("Sent to Brain router.");
  return { ok: true, message: "Sent to Brain router.", panelId: "Brain" };
}
