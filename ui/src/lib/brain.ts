import { loadJSON, saveJSON } from "./storage";
import { getNotifs, pushNotif } from "./notifs";
import { isDesktop, oddApi } from "./odd";
import { loadPrefs } from "./prefs";

export type PanelMeta = {
  id: string;
  icon: string;
  title: string;
  sub: string;
  section: string;
  assistantName: string;
  assistantRole: string;
  description: string;
  quickPrompts: string[];
  storageKeys: string[];
  nextSteps: string[];
  quickActionIds?: string[];
  actions?: Array<{ id: string; label: string; kind: "navigate" | "setStorage" | "help"; panelId?: string; storageKey?: string; storageValue?: any }>;
};

export type BrainNote = {
  id: string;
  ts: number;
  panelId: string;
  title: string;
  body: string;
  pinned?: boolean;
};

export type ActivityItem = {
  id: string;
  ts: number;
  kind: "visit" | "assistant" | "note" | "command" | "system";
  panelId?: string;
  title: string;
  body?: string;
  tags?: string[];
};

export type PanelContext = {
  panelId: string;
  meta: PanelMeta;
  summary: string;
  details: string[];
  storage: Record<string, any>;
};

export type BrainChatMessage = { role: "user" | "assistant"; content: string; ts: number };

export type AssistantBadge = { label: string; tone: "good" | "warn" | "bad" | "muted" };
export type AssistantInsight = {
  tone: "good" | "warn" | "bad" | "muted";
  headline: string;
  badges: AssistantBadge[];
  wins: string[];
  watchouts: string[];
  suggestedActions: string[];
};

export type QuickActionResult = { ok: boolean; message: string; panelId?: string };
export type ActionChain = { id: string; label: string; panelId: string; description: string; actionIds: string[] };
export type PanelActionEnvelope = { id: string; ts: number; panelId: string; actionId: string; payload?: any };
export type BrainMemory = { id: string; ts: number; panelId: string; kind: "action" | "insight" | "automation" | "error" | "system"; title: string; body: string; tags?: string[] };
export type UndoStep = { kind: "storage"; key: string; prev: any };
export type ActionRecord = {
  id: string;
  ts: number;
  panelId: string;
  actionId: string;
  title: string;
  body: string;
  status: "success" | "info" | "warn" | "error";
  undoSteps?: UndoStep[];
  undoneAt?: number | null;
};

export type PanelHealth = {
  panelId: string;
  title: string;
  icon: string;
  score: number;
  status: "good" | "warn" | "error";
  headline: string;
  reasons: string[];
  badges: AssistantBadge[];
  nextActionId?: string;
  nextActionLabel?: string;
};

export type TopPriority = {
  id: string;
  panelId: string;
  level: "good" | "warn" | "error";
  title: string;
  text: string;
  actionId?: string;
  actionLabel?: string;
  score: number;
};

export type ActionQueueItem = {
  id: string;
  panelId: string;
  level: "good" | "warn" | "error";
  title: string;
  body: string;
  actionId?: string;
  actionLabel?: string;
  score: number;
};

export type MissionControlChip = {
  label: string;
  actionId: string;
};

export type MissionControlPanelCard = {
  id: string;
  panelId: string;
  level: "good" | "warn" | "error";
  score: number;
  priorityTitle: string;
  priorityText: string;
  nextActionId?: string;
  nextActionLabel?: string;
  chips: MissionControlChip[];
};

export type OperatorFeedItem = {
  id: string;
  ts: number;
  panelId: string;
  source: "action" | "memory" | "activity" | "notification" | "mission";
  level: "good" | "warn" | "error" | "muted";
  title: string;
  body: string;
};

const ACTIVITY_KEY = "oddengine:brain:activity:v1";
const NOTES_KEY = "oddengine:brain:notes:v1";
const GOALS_KEY = "oddengine:brain:goals:v1";
const CHAT_PREFIX = "oddengine:brain:chat:";
const MEMORY_KEY = "oddengine:brain:memory:v1";
const ACTION_HISTORY_KEY = "oddengine:brain:actionHistory:v1";
export const BRAIN_INBOX_KEY = "oddengine:brain:inbox:v1";
export const PANEL_ACTION_QUEUE_KEY = "oddengine:brain:panelActions:v1";
export const PANEL_ACTION_EVENT = "oddengine:panel-action";
const HOMIE_SETTINGS_KEY = "oddengine:homie:settings:v1";

export const PANEL_META: PanelMeta[] = [
  { id:"Home", icon:"🏠", title:"Home", sub:"Smooth launcher + dashboard", section:"ODDENGINE", assistantName:"FairlyGOD", assistantRole:"Operator home + quick routing", description:"A smooth OS-style homepage: widgets, app tiles, and quick routes into every panel.", quickPrompts:["What should I do first today?","Open my morning routine.","Show my upcoming calendar and priorities."], storageKeys:["oddengine:activePanel","oddengine:pinnedPanels","oddengine:calendar:v1"], nextSteps:["Use Home to jump into panels fast.","Pin your top 6 apps for one-click launch.","Review Calendar + missions before you open trading."], actions:[{ id:"calendar", label:"Open Calendar", kind:"navigate", panelId:"Calendar" },{ id:"routine", label:"Open Routine Launcher", kind:"navigate", panelId:"RoutineLauncher" }] },
  { id:"OddBrain", icon:"🧠", title:"OddBrain", sub:"Master health AI", section:"ODDENGINE", assistantName:"OddBrain Ops", assistantRole:"OS health + readiness guide", description:"Summarizes platform readiness, stale data, and system tasks.", quickPrompts:["What changed across the OS?","What needs attention first?","Give me a quick readiness summary."], storageKeys:["oddengine:grow:profile","oddengine:cameras:v1","oddengine:cryptoGames:v2","oddengine:mining:v1","oddengine:oddbrain:skip:v1"], nextSteps:["Check stale modules and readiness.","Seed empty panels that need starter data.","Use Brain for a cross-panel digest."], actions:[{ id:"brain", label:"Open Brain", kind:"navigate", panelId:"Brain" }] },
  { id:"Homie", icon:"👊", title:"Homie", sub:"OS guide + AI helper", section:"ODDENGINE", assistantName:"Homie", assistantRole:"Main conversational shell", description:"Handles deep chat, local Ollama routing, and dev-friendly help.", quickPrompts:["Summarize my last problem plainly.","Turn this into steps.","What should I do next?"], storageKeys:["oddengine:homie:chat:v1","oddengine:homie:settings:v1","oddengine:homie:targetProject:v1"], nextSteps:["Use Homie for longer sessions.","Pin useful replies into Brain.","Switch to panel copilots for contextual help."] },
  { id:"DevEngine", icon:"🧩", title:"Dev Engine", sub:"Projects + builds + logs", section:"ODDENGINE", assistantName:"Dev Copilot", assistantRole:"Project health + build triage", description:"Explains logs, suggests fixes, and helps run safe playbooks.", quickPrompts:["Explain the likely root cause.","Give me the safest fix path.","What should I check before rebuilding?"], storageKeys:["oddengine:dev:projectDir","oddengine:homie:targetProject:v1"], nextSteps:["Set a target project folder.","Use safe playbooks before manual fixes.","Keep the last error and last good run visible."], actions:[{ id:"homie", label:"Open Homie", kind:"navigate", panelId:"Homie" }] },
  { id:"Autopilot", icon:"🤖", title:"Autopilot", sub:"Generators → real files", section:"ODDENGINE", assistantName:"Autopilot Builder", assistantRole:"Generator guide + output planner", description:"Turns rough ideas into generator-friendly briefs and next steps.", quickPrompts:["Turn this idea into a build brief.","What should the output include?","What is the fastest shippable scope?"], storageKeys:[], nextSteps:["Start with a tight brief.","Pick one output target first.","Preview before exporting."] },
  { id:"Builder", icon:"🧱", title:"Builder", sub:"Canvas + inspector", section:"ODDENGINE", assistantName:"UI Architect", assistantRole:"Layout critique + component planning", description:"Suggests layout cleanup, hierarchy fixes, and export-ready structure.", quickPrompts:["How can this layout feel more premium?","What components am I missing?","How should I structure this page?"], storageKeys:[], nextSteps:["Use consistent spacing and hierarchy.","Break large scenes into reusable parts.","Export small, testable blocks."] },
  { id:"Plugins", icon:"🧩", title:"Plugins", sub:"*.plugin.json loader", section:"ODDENGINE", assistantName:"Plugin Guide", assistantRole:"Plugin install + health helper", description:"Explains plugin status and helps diagnose broken manifests.", quickPrompts:["What plugin types should I add next?","How do I debug a broken plugin?","Which plugins look missing or unhealthy?"], storageKeys:["oddengine:plugins:user:v1"], nextSteps:["Track installed vs broken plugins.","Prefer small plugin templates first.","Show capability and health clearly."], actions:[{ id:"security", label:"Open Security", kind:"navigate", panelId:"Security" }] },
  { id:"Money", icon:"💵", title:"Money", sub:"ROI tiers + actions", section:"ODDENGINE", assistantName:"Revenue Coach", assistantRole:"Offer builder + monetization helper", description:"Turns ideas into offers, pricing, and fastest-to-cash paths.", quickPrompts:["What should I monetize first?","Give me a simple offer ladder.","What is the fastest $ path here?"], storageKeys:["oddengine:money:offers:v1"], nextSteps:["Start with a single offer.","Package outputs for one buyer type.","Use low-friction pricing first."] },
  { id:"FamilyBudget", icon:"🏡", title:"Family Budget", sub:"Household cashflow + goals", section:"ODDENGINE", assistantName:"Budget Coach", assistantRole:"Cashflow + payoff strategist", description:"Explains spending, payoff tradeoffs, and next budget actions.", quickPrompts:["Where are we leaking money?","What debt should we hit first?","Summarize this month vs last month."], storageKeys:["oddengine:familyBudget:v2","oddengine:familyBudget:tab"], nextSteps:["Review cashflow and due dates.","Use payoff planner before extra payments.","Watch recurring items and goals together."], quickActionIds:["budget:payoff-avalanche","budget:payoff-snowball","budget:test-sync","budget:fund-goals"], actions:[{ id:"payoff", label:"Open Payoff", kind:"setStorage", panelId:"FamilyBudget", storageKey:"oddengine:familyBudget:tab", storageValue:"Payoff" },{ id:"reports", label:"Open Reports", kind:"setStorage", panelId:"FamilyBudget", storageKey:"oddengine:familyBudget:tab", storageValue:"Reports" }] },
  { id:"Brain", icon:"🧠", title:"Brain", sub:"AI router + memory", section:"CORE PANELS", assistantName:"AI Brain", assistantRole:"Cross-panel memory + orchestration", description:"Routes assistant context, tracks notes, and builds daily digests.", quickPrompts:["Give me a cross-panel digest.","Where should I focus next?","Summarize the biggest OS risks."], storageKeys:[GOALS_KEY, NOTES_KEY, ACTIVITY_KEY], nextSteps:["Keep goals fresh.","Pin useful notes from panel copilots.","Use daily digest before jumping around."] },
  { id:"HappyHealthy", icon:"💚", title:"Happy Healthy", sub:"Wellness tracker", section:"CORE PANELS", assistantName:"Wellness Coach", assistantRole:"Pattern summary + check-in helper", description:"Summarizes trends and turns notes into cleaner wellness actions.", quickPrompts:["What patterns show up here?","What should I track next?","Turn this into a simple routine."], storageKeys:["oddengine:happyhealthy:v1"], nextSteps:["Log entries consistently.","Watch repeat triggers.","Use summaries before appointments."] },
  { id:"Cannabis", icon:"🌿", title:"Cannabis", sub:"Events + bookmarks", section:"CORE PANELS", assistantName:"Cannabis Concierge", assistantRole:"Deals, favorites, and event organizer", description:"Ranks saved deals, compares options, and helps plan trips or runs.", quickPrompts:["What are my best saved deals?","Help me compare favorites.","What should I clean up here?"], storageKeys:["oddengine:cannabis:v3","oddengine:prefs:v1"], nextSteps:["Keep favorites tagged.","Use score + notes together.","Review events and bookmarks regularly."] },
  { id:"Trading", icon:"🎯", title:"Trading", sub:"Options Sniper engine", section:"CORE PANELS", assistantName:"Trading Coach", assistantRole:"Setup ranking + risk coaching", description:"Summarizes setups, risk, and next trading actions from the panel state.", quickPrompts:["Summarize today’s setup.","What is the biggest risk here?","Rank the cleanest next move."], storageKeys:["oddengine:trading:sniper:v4","odd.trading.chainSnapshot"], nextSteps:["Write the thesis before entries.","Keep invalidation and size visible.","Use contract quality before impulse."], quickActionIds:["trading:safer-setup","trading:focus-best","trading:build-plan"], actions:[{ id:"homie", label:"Open Homie", kind:"navigate", panelId:"Homie" }] },
  { id:"Grow", icon:"🌱", title:"Grow", sub:"Grow OS hook", section:"CORE PANELS", assistantName:"Grow Coach", assistantRole:"Environment + stage coach", description:"Interprets readings, stage, and planner settings into next grow actions.", quickPrompts:["What matters most in this room?","What is drifting out of range?","Give me a simple next-step checklist."], storageKeys:["oddengine:grow:profile","oddengine:grow:readings","oddengine:grow:live:v2","oddengine:grow:planner:v1","oddengine:grow:demo:v1"], nextSteps:["Log readings often enough to see drift.","Tie environment to feed or stage changes.","Use a daily checklist during stage transitions."], quickActionIds:["grow:apply-targets","grow:save-reading","grow:load-planner-profile","grow:ac-infinity-preset"] },
  { id:"Mining", icon:"⛏️", title:"Mining", sub:"Mining Radar hook", section:"CORE PANELS", assistantName:"Mining Radar", assistantRole:"Miner health + payout coach", description:"Summarizes miner uptime, pools, and payout health.", quickPrompts:["Which miner needs attention?","Do payouts look healthy?","What should I optimize next?"], storageKeys:["oddengine:mining:v1"], nextSteps:["Track payout gaps.","Keep miner notes and power visible.","Compare pools before switching."], actions:[{ id:"money", label:"Open Money", kind:"navigate", panelId:"Money" }] },
  { id:"CryptoGames", icon:"🎮", title:"Crypto Games", sub:"Tracker (local)", section:"APPS", assistantName:"Game Scout", assistantRole:"Reward + device planner", description:"Helps rank games, wallets, and emulator paths.", quickPrompts:["What looks worth playing?","Which games need cleanup?","What is the easiest earning path?"], storageKeys:["oddengine:cryptoGames:v2","oddengine:cryptoGames:settings:v1"], nextSteps:["Track real rewards.","Keep emulator preference clear.","Cull low-value games quickly."] },
  { id:"Cameras", icon:"📹", title:"Cameras", sub:"NVR command center", section:"APPS", assistantName:"Camera Guard", assistantRole:"Camera health + wall planner", description:"Summarizes wall setup, camera counts, and simple readiness notes.", quickPrompts:["What looks unhealthy here?","How should I arrange the wall?","What setup is missing?"], storageKeys:["oddengine:cameras:v1","oddengine:prefs:v1"], nextSteps:["Label zones clearly.","Watch stale or offline feeds.","Use presets for repeat layouts."] },
  { id:"OptionsSaaS", icon:"📈", title:"Options SaaS", sub:"Idea/spec board", section:"APPS", assistantName:"SaaS Strategist", assistantRole:"MVP scope + offer planner", description:"Turns product ideas into an MVP brief, roadmap, and pricing path.", quickPrompts:["What should the MVP include?","What is missing from this spec?","Give me a launch checklist."], storageKeys:["oddengine:optionssaas:v1"], nextSteps:["Define one clear buyer.","Keep MVP scope small.","Write routes/data needs before build."], actions:[{ id:"money", label:"Open Money", kind:"navigate", panelId:"Money" }] },
  { id:"News", icon:"📰", title:"News", sub:"Weather + local + world + economics", section:"APPS", assistantName:"News Operator", assistantRole:"News, weather, and briefing lane", description:"Keeps a live headline lane ready for Mission Control, Budget, and Trading.", quickPrompts:["What matters most in the news right now?","Give me the local weather and biggest headlines.","What headlines matter for trading or family planning?"], storageKeys:["oddengine:news:v1"], nextSteps:["Refresh weather and headlines.","Use Brain to summarize what matters.","Route important items into the right panel."], quickActionIds:["news:refresh"], actions:[{ id:"brain", label:"Open Brain", kind:"navigate", panelId:"Brain" }] },
  { id:"FamilyHealth", icon:"🩺", title:"Family Health", sub:"Household care briefs + research", section:"CORE PANELS", assistantName:"Care Guide", assistantRole:"Family member organizer + research helper", description:"Keeps structured family health notes and research lanes in one place.", quickPrompts:["Turn these notes into a care brief.","What should I track for this family member?","What should I research from trusted sources?"], storageKeys:["oddengine:familyHealth:v1"], nextSteps:["Keep one tab per family member.","Build short care briefs before appointments.","Use trusted sources and research links, not diagnosis guesses."], quickActionIds:["family-health:research"], actions:[{ id:"brain", label:"Open Brain", kind:"navigate", panelId:"Brain" }] },
  { id:"GroceryMeals", icon:"🛒", title:"Grocery Meals", sub:"Meal planning + coupon lane", section:"CORE PANELS", assistantName:"Savings Chef", assistantRole:"Meal planner + grocery savings helper", description:"Turns meal plans into grocery lists and keeps a live coupon lane open.", quickPrompts:["Build a cheaper weekly meal plan.","What should I buy this week?","How can I save more on groceries?"], storageKeys:["oddengine:groceryMeals:v1"], nextSteps:["Plan meals first.","Use pantry-aware lists.","Refresh the coupon lane before shopping."], quickActionIds:["grocery:build-list","grocery:coupon-lane"], actions:[{ id:"brain", label:"Open Brain", kind:"navigate", panelId:"Brain" }] },
  { id:"DailyChores", icon:"🧹", title:"Daily Chores", sub:"Household + outdoor + animals", section:"CORE PANELS", assistantName:"House Ops", assistantRole:"Daily task coordinator", description:"Keeps house, outdoor, and animal care tasks in one calm command center.", quickPrompts:["What chores matter most today?","Build me a quick house reset list.","What animal care tasks are still open?"], storageKeys:["oddengine:dailyChores:v1"], nextSteps:["Start with the house reset lane.","Handle outdoor checks before evening.","Close animal care tasks before end of day."], actions:[{ id:"home", label:"Open Home", kind:"navigate", panelId:"Home" }] },
  { id:"Entertainment", icon:"🎬", title:"Family Entertainment", sub:"Music + movies + streaming", section:"CORE PANELS", assistantName:"Entertainment DJ", assistantRole:"Family music/movie launcher", description:"Keeps your streaming services one click away and opens playback in a separate window.", quickPrompts:["Open our music.","Put on a movie.","Add a new streaming service."], storageKeys:["oddengine:entertainment:v1"], nextSteps:["Keep your services list updated.","Flip DRM services to External if playback fails.","Use this panel for family night quick launches."], quickActionIds:["entertainment:open-spotify","entertainment:open-youtube","entertainment:open-netflix"], actions:[{ id:"homie", label:"Open Homie", kind:"navigate", panelId:"Homie" }] },
  { id:"Books", icon:"✍️", title:"Studio", sub:"AI creation pipeline + working copies", section:"CORE PANELS", assistantName:"Homie (Studio)", assistantRole:"Prompt-to-project creative operator", description:"FairlyOdd Studio inside the larger FairlyOdd OS: one prompt into songs, books, cartoons, videos, render jobs, and producer-ready working packets.", quickPrompts:["Start a new studio project from one prompt.","Turn this idea into a finished creative pipeline.","Build writing, director, music, and render lanes for this concept."], storageKeys:["oddengine:books:v1","oddengine:writers:chat:v1"], nextSteps:["Start from one master prompt.","Let the AI build writing, director, music, and render lanes.","Use Producer Ops to package the final working copy."], quickActionIds:["books:add","books:copy-active"], actions:[{ id:"homie", label:"Open Homie", kind:"navigate", panelId:"Homie" },{ id:"calendar", label:"Open Calendar", kind:"navigate", panelId:"Calendar" }] },
  { id:"RoutineLauncher", icon:"🚀", title:"Routine Launcher", sub:"One-button OS routines", section:"CORE PANELS", assistantName:"Routine Operator", assistantRole:"Applies global sets + launches panel sequences", description:"Applies a global layout set (like Morning Routine) and opens a chosen sequence of panels in one click.", quickPrompts:["Apply my Morning Routine.","Launch my trading-to-grow routine.","Build a new routine set."], storageKeys:["oddengine:routines:v1","oddengine:godglobalsets:v1"], nextSteps:["Save layouts into a global set.","Create a routine with a set + panel sequence.","Launch in windows for true multi-panel cockpit."], quickActionIds:["routine:apply-set","routine:launch"], actions:[{ id:"brain", label:"Open Brain", kind:"navigate", panelId:"Brain" }] },
  { id:"Calendar", icon:"📅", title:"Calendar", sub:"Schedule + reminders", section:"CORE PANELS", assistantName:"Calendar Buddy", assistantRole:"Schedule + tie-ins", description:"Month view calendar with local events and deep links into panels.", quickPrompts:["What's on today?","Add a reminder for this week.","Show upcoming events."], storageKeys:["oddengine:calendar:v1"], nextSteps:["Add key reminders (bills, routines, grow flips).","Link events to panels for one-click jumping.","Review upcoming before morning routines."], actions:[{ id:"routine", label:"Open Routine Launcher", kind:"navigate", panelId:"RoutineLauncher" }] },
  { id:"Preferences", icon:"⚙️", title:"Preferences", sub:"Defaults + saved settings", section:"OS", assistantName:"Setup Assistant", assistantRole:"Defaults + safe settings helper", description:"Explains settings and recommends better defaults for your workflow.", quickPrompts:["What settings should I tighten up?","How should I tune defaults?","What preferences are worth changing?"], storageKeys:["oddengine:prefs:v1"], nextSteps:["Use panel defaults to reduce setup friction.","Keep AI defaults consistent.","Export or screenshot your preferred config."] },
  { id:"Security", icon:"🛡️", title:"Security", sub:"IP lock + notes", section:"OS", assistantName:"Security Sentinel", assistantRole:"Local-only + trust center helper", description:"Explains exposure, local-only status, and trust boundaries simply.", quickPrompts:["What is exposed right now?","What should I harden first?","Give me a safe local-only checklist."], storageKeys:["oddengine:security:v1","oddengine:plugins:user:v1"], nextSteps:["Keep IP lock on when possible.","Know when LAN mode is active.","Review plugin trust and local-only paths."] },
];

const PANEL_ALIASES: Record<string, string> = Object.fromEntries(
  PANEL_META.flatMap((p) => {
    const pairs: Array<[string, string]> = [
      [p.id.toLowerCase(), p.id],
      [p.title.toLowerCase(), p.id],
      [p.title.replace(/\s+/g, "").toLowerCase(), p.id],
    ];
    if (p.id === "CryptoGames") pairs.push(["zbd", p.id], ["crypto", p.id], ["games", p.id]);
    if (p.id === "FamilyBudget") pairs.push(["budget", p.id], ["familybudget", p.id]);
    if (p.id === "OptionsSaaS") pairs.push(["saas", p.id], ["options", p.id]);
    if (p.id === "HappyHealthy") pairs.push(["healthy", p.id], ["wellness", p.id]);
    if (p.id === "News") pairs.push(["weather", p.id], ["local news", p.id]);
    if (p.id === "FamilyHealth") pairs.push(["medical", p.id], ["health", p.id], ["family health", p.id]);
    if (p.id === "GroceryMeals") pairs.push(["grocery", p.id], ["meals", p.id], ["meal planning", p.id]);
    if (p.id === "DailyChores") pairs.push(["chores", p.id], ["household", p.id], ["animals", p.id]);
    if (p.id === "Calendar") pairs.push(["calendar", p.id], ["schedule", p.id], ["planner", p.id]);
    return pairs;
  })
);

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function safeJson(key: string) {
  return loadJSON<any>(key, null as any);
}

function compactValue(value: any, depth = 2): any {
  if (depth <= 0) return Array.isArray(value) ? `[${value.length} items]` : typeof value;
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 4).map((item) => compactValue(item, depth - 1));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).slice(0, 8).map(([k, v]) => [k, compactValue(v, depth - 1)]);
    return Object.fromEntries(entries);
  }
  if (typeof value === "string" && value.length > 160) return value.slice(0, 157) + "…";
  return value;
}

function countWhere<T>(arr: T[] | undefined | null, pred: (item: T) => boolean) {
  return (arr || []).filter(pred).length;
}

export function normalizePanelId(raw: string | undefined | null) {
  const key = String(raw || "").trim();
  if (!key) return "OddBrain";
  return PANEL_ALIASES[key.toLowerCase()] || key;
}

export function getPanelMeta(panelId: string): PanelMeta {
  const normalized = normalizePanelId(panelId);
  return PANEL_META.find((p) => p.id === normalized) || PANEL_META[0];
}

export function getPanelActions(panelId: string) {
  const normalized = normalizePanelId(panelId);
  return loadJSON<PanelActionEnvelope[]>(PANEL_ACTION_QUEUE_KEY, []).filter((item) => normalizePanelId(item.panelId) === normalized);
}

export function acknowledgePanelAction(actionId: string) {
  saveJSON(PANEL_ACTION_QUEUE_KEY, loadJSON<PanelActionEnvelope[]>(PANEL_ACTION_QUEUE_KEY, []).filter((item) => item.id !== actionId));
}

export function queuePanelAction(panelId: string, actionId: string, payload?: any) {
  const envelope: PanelActionEnvelope = { id: uid("pact"), ts: Date.now(), panelId: normalizePanelId(panelId), actionId, payload };
  const list = loadJSON<PanelActionEnvelope[]>(PANEL_ACTION_QUEUE_KEY, []);
  saveJSON(PANEL_ACTION_QUEUE_KEY, [envelope, ...list].slice(0, 80));
  try {
    window.dispatchEvent(new CustomEvent(PANEL_ACTION_EVENT, { detail: envelope }));
  } catch {}
  return envelope;
}

export function getBrainMemories(panelId?: string) {
  const list = loadJSON<BrainMemory[]>(MEMORY_KEY, []);
  return panelId ? list.filter((item) => normalizePanelId(item.panelId) === normalizePanelId(panelId)) : list;
}

export function addBrainMemory(input: Omit<BrainMemory, "id" | "ts">) {
  const list = getBrainMemories();
  const next: BrainMemory = { id: uid("mem"), ts: Date.now(), ...input, panelId: normalizePanelId(input.panelId) };
  list.unshift(next);
  saveJSON(MEMORY_KEY, list.slice(0, 180));
  return next;
}

export function getActionHistory(panelId?: string) {
  const list = loadJSON<ActionRecord[]>(ACTION_HISTORY_KEY, []);
  return panelId ? list.filter((item) => normalizePanelId(item.panelId) === normalizePanelId(panelId)) : list;
}

export function rememberActionOutcome(input: Omit<ActionRecord, "id" | "ts"> & { pushToast?: boolean }) {
  const { pushToast = true, ...rest } = input;
  const list = getActionHistory();
  const record: ActionRecord = {
    id: uid("action"),
    ts: Date.now(),
    panelId: normalizePanelId(rest.panelId),
    actionId: rest.actionId,
    title: rest.title,
    body: rest.body,
    status: rest.status,
    undoSteps: rest.undoSteps || [],
    undoneAt: rest.undoneAt ?? null,
  };
  list.unshift(record);
  saveJSON(ACTION_HISTORY_KEY, list.slice(0, 180));
  addBrainMemory({ panelId: record.panelId, kind: "action", title: record.title, body: record.body, tags: [record.actionId, record.status] });
  logActivity({ kind: "system", panelId: record.panelId, title: record.title, body: record.body, tags: [record.actionId, record.status] });
  if (pushToast) {
    pushNotif({
      title: `${getPanelMeta(record.panelId).title} confirmation`,
      body: `${record.title} — ${record.body}`,
      tags: [record.panelId, "AI"],
      level: record.status === "error" ? "error" : record.status === "warn" ? "warn" : record.status === "info" ? "info" : "success",
    });
  }
  return record;
}

export function undoActionRecord(recordId: string): QuickActionResult {
  const list = getActionHistory();
  const target = list.find((item) => item.id === recordId);
  if (!target) return { ok: false, message: "Undo target was not found." };
  if (!target.undoSteps?.length) return { ok: false, message: "That action does not have an undo snapshot." };
  if (target.undoneAt) return { ok: false, message: "That action was already undone." };
  [...target.undoSteps].reverse().forEach((step) => {
    if (step.kind === "storage") saveJSON(step.key, step.prev);
  });
  const next = list.map((item) => item.id === recordId ? { ...item, undoneAt: Date.now() } : item);
  saveJSON(ACTION_HISTORY_KEY, next);
  queuePanelAction(target.panelId, "system:reload-from-storage", { source: "undo", recordId });
  addBrainMemory({ panelId: target.panelId, kind: "system", title: `Undid ${target.title}`, body: `Rolled back ${target.actionId}.`, tags: ["undo", target.actionId] });
  logActivity({ kind: "system", panelId: target.panelId, title: `Undid ${target.title}`, body: `Rolled back ${target.actionId}.`, tags: ["undo", target.actionId] });
  pushNotif({ title: `${getPanelMeta(target.panelId).title} rollback`, body: `Undid ${target.title}.`, tags: [target.panelId, "undo"], level: "success" });
  return { ok: true, message: `Rolled back ${target.title}.`, panelId: target.panelId };
}

export function undoLatestAction(panelId?: string): QuickActionResult {
  const target = getActionHistory(panelId).find((item) => !item.undoneAt && item.undoSteps?.length);
  if (!target) return { ok: false, message: panelId ? `No undoable actions found for ${getPanelMeta(panelId).title}.` : "No undoable AI actions found yet." };
  return undoActionRecord(target.id);
}

function buildRecentMemorySummary(panelId: string, limit = 5) {
  const normalized = normalizePanelId(panelId);
  const memories = getBrainMemories().filter((item) => item.panelId === normalized || item.panelId === "Brain").slice(0, limit);
  if (!memories.length) return "";
  return memories.map((item) => `- ${new Date(item.ts).toLocaleString()}: ${item.title} — ${item.body}`).join("\n");
}

function summarizeBudget(state: any) {
  if (!state) return ["No family budget snapshot saved yet."];
  const liabilities = (state.accounts || []).filter((a: any) => ["CREDIT_CARD", "LOAN"].includes(String(a.type || "")));
  const totalAssets = (state.accounts || []).filter((a: any) => !["CREDIT_CARD", "LOAN"].includes(String(a.type || ""))).reduce((sum: number, a: any) => sum + Number(a.balance || 0), 0);
  const totalLiabilities = liabilities.reduce((sum: number, a: any) => sum + Math.abs(Number(a.balance || 0)), 0);
  return [
    `${state.household?.name || "Household"} • ${(state.accounts || []).length} accounts • ${(state.transactions || []).length} transactions`,
    `${liabilities.length} liabilities • assets ${formatCurrency(totalAssets)} • liabilities ${formatCurrency(totalLiabilities)}`,
    `${(state.goals || []).length} goals • ${(state.recurring || []).length} recurring items • ${(state.budgetLines || []).length} budget lines`,
    `Sync bridge: ${state.syncBridge?.enabled ? "enabled" : "off"}${state.syncBridge?.lastStatus ? ` • ${state.syncBridge.lastStatus}` : ""}`,
  ];
}

function summarizeTrading(state: any, chain: any) {
  if (!state && !chain) return ["No trading state saved yet."];
  const watchCount = String(state?.watchlist || "").split(/[\s,\n]+/).filter(Boolean).length;
  return [
    `${state?.symbol || chain?.symbol || "Ticker"} • ${String(state?.bias || "neutral").toUpperCase()} bias • ${String(state?.timeframe || "weeklies").toUpperCase()}`,
    `Setup ${state?.setup || "n/a"} • data ${state?.dataMode || "website"} • watchlist ${watchCount}`,
    chain ? `Chain snapshot: ${chain.symbol || state?.symbol || "n/a"} ${chain.expiration || ""} • ${Array.isArray(chain.contracts) ? chain.contracts.length : 0} contracts` : "No chain snapshot stored yet.",
  ];
}

function summarizeGrow(profile: any, readings: any[], live: any, planner: any) {
  if (!profile && !(readings || []).length) return ["No grow profile or readings saved yet."];
  const last = (readings || []).slice(-1)[0];
  return [
    `${profile?.name || "Grow room"} • ${String(profile?.stage || "veg").toUpperCase()} • ${profile?.size || "size n/a"}`,
    `${(readings || []).length} readings logged${last ? ` • latest temp ${last.temp ?? "?"} • RH ${last.rh ?? "?"}` : ""}`,
    `Live: ${live?.enabled ? "on" : "off"} • planner: ${planner?.enabled ? "enabled" : "off"}`,
  ];
}

function summarizeMining(state: any) {
  if (!state) return ["No mining state saved yet."];
  const lastPayout = [...(state.payouts || [])].sort((a: any, b: any) => Number(b.ts || 0) - Number(a.ts || 0))[0];
  return [
    `${(state.miners || []).length} miners • ${(state.pools || []).length} pools • ${(state.payouts || []).length} payouts logged`,
    `Alert threshold: ${state.alertCfg?.noPayoutHours || 24}h without payout`,
    lastPayout ? `Last payout ${Number(lastPayout.sats || 0)} sats` : "No payouts recorded yet.",
  ];
}

function summarizeCannabis(state: any) {
  if (!state) return ["No cannabis data saved yet."];
  return [
    `${(state.favorites || []).length} favorites • ${(state.deals || []).length} deals • ${(state.notes || []).length} notes`,
    `${(state.categories || []).length} categories • ${(state.priceTiers || []).length} price tiers • ZIP ${state.zip || "n/a"}`,
    `Min score ${state.filters?.minScore ?? "n/a"}`,
  ];
}

function summarizeWellness(state: any) {
  const entries = state?.entries || [];
  if (!entries.length) return ["No wellness entries saved yet."];
  const last = entries[entries.length - 1];
  return [
    `${entries.length} entries logged`,
    `Latest day: ${last.date || "n/a"} • energy ${last.energy ?? "?"} • mood ${last.mood ?? "?"}`,
    last.notes ? `Latest note: ${String(last.notes).slice(0, 80)}${String(last.notes).length > 80 ? "…" : ""}` : "Latest entry has no note.",
  ];
}

function summarizeGames(state: any, settings: any) {
  if (!state) return ["No crypto games tracked yet."];
  return [
    `${(state.games || []).length} games tracked • preferred emulator ${state.preferredEmuId || "auto"}`,
    `Wallet ${settings?.walletAddress ? "saved" : "not saved"}`,
  ];
}

function summarizeCameras(state: any) {
  if (!state) return ["No camera wall saved yet."];
  return [
    `${(state.cameras || []).length} cameras • ${(state.nvrs || []).length} NVRs`,
    `Wall ${state.wall?.grid || "4x3"} • live ${state.wall?.live ? "on" : "off"} • page ${state.wall?.page ?? 0}`,
  ];
}

function summarizePlugins(state: any[]) {
  return state && state.length ? [`${state.length} user plugin records saved locally.`] : ["No user plugin metadata saved yet."];
}

function summarizeSaaS(state: any) {
  if (!state) return ["No SaaS planner saved yet."];
  if (typeof state === "string") return [`Legacy spec text length: ${state.length} chars.`];
  return [
    `${state.productName || "Untitled product"} • ${state.targetUser || "target user n/a"}`,
    `Core promise: ${state.promise ? String(state.promise).slice(0, 80) : "n/a"}`,
    `Pricing ${state.pricing?.entry || "n/a"} • roadmap items ${(state.roadmap || []).length || 0}`,
  ];
}

function summarizeSecurity(state: any, pluginState: any[]) {
  return [
    `IP lock ${state?.ipLock ? "ON" : "OFF"}`,
    `${pluginState?.length || 0} user plugins saved locally`,
    `${isDesktop() ? "Desktop mode" : "Web mode"} • host ${window.location.hostname}`,
  ];
}

function summarizePrefs(state: any) {
  if (!state) return ["No preferences saved yet."];
  return [
    `Desktop start panel ${state.desktop?.startPanel || "OddBrain"} • safe fixes ${state.desktop?.autoRunSafeFixes ? "on" : "off"}`,
    `AI tone ${state.ai?.tone || "coach"} • verbosity ${state.ai?.verbosity || "balanced"}`,
  ];
}

function summarizeNews(state: any) {
  if (!state) return ["No news snapshot saved yet."];
  const weather = state.weather;
  return [
    `${state.location || weather?.location || "Location n/a"} • ${state.lastUpdated ? "updated" : "not refreshed"}`,
    weather ? `Weather ${weather.tempF}°F • feels ${weather.feelsLikeF}°F • ${weather.description}` : "No weather snapshot yet.",
    `Local ${(state.feeds?.local || []).length} • world ${(state.feeds?.world || []).length} • economics ${(state.feeds?.economics || []).length} headlines`,
  ];
}

function summarizeFamilyHealth(state: any) {
  if (!state) return ["No family health notebook saved yet."];
  const members = Array.isArray(state.members) ? state.members : [];
  const active = members.find((m: any) => m.id === state.activeId) || members[0] || null;
  return [
    `${members.length} family member tabs • ${state.disclaimerAccepted ? "safety note accepted" : "review safety note"}`,
    active ? `Active: ${active.name || "Unnamed"}${active.conditions ? ` • ${String(active.conditions).slice(0, 48)}` : ""}` : "No active family member selected.",
    `${state.careBrief ? "Care brief ready" : "No care brief yet"} • ${(active?.lastResearch || []).length || 0} saved research items`,
  ];
}

function summarizeGroceryMeals(state: any) {
  if (!state) return ["No grocery or meal plan saved yet."];
  return [
    `${(state.meals || []).length} planned days • ${(state.groceryList || []).length} grocery items`,
    `${(state.couponFeed || []).length} coupon/deal headlines • pantry ${(String(state.pantry || "").split(/\n+/).filter(Boolean)).length} items`,
    state.dietaryTags ? `Dietary tags: ${String(state.dietaryTags).slice(0, 80)}` : "No dietary tags saved yet.",
  ];
}

function summarizeMoney(state: any) {
  if (!state) return ["No saved offer builder data yet."];
  return [
    `${(state.offers || []).length || 0} offers drafted • focus ${state.focus || "n/a"}`,
    `Fastest path: ${state.fastestPath || "n/a"}`,
  ];
}

function summarizeHomie(state: any, chat: any[]) {
  return [
    `Model ${state?.model || "llama3.1:8b"} • include context ${state?.includeContext ? "on" : "off"}`,
    `${(chat || []).length} saved chat messages`,
    `Target project ${loadJSON<string>("oddengine:homie:targetProject:v1", "") || "not set"}`,
  ];
}

function summarizeDev(projectDir: string | null) {
  return [projectDir ? `Project folder: ${projectDir}` : "No project folder chosen yet."];
}

export function readPanelContext(panelId: string): PanelContext {
  const meta = getPanelMeta(panelId);
  const storage: Record<string, any> = {};
  for (const key of meta.storageKeys) storage[key] = safeJson(key);

  let details: string[] = [];
  if (meta.id === "FamilyBudget") details = summarizeBudget(storage["oddengine:familyBudget:v2"]);
  else if (meta.id === "Trading") details = summarizeTrading(storage["oddengine:trading:sniper:v4"], storage["odd.trading.chainSnapshot"]);
  else if (meta.id === "Grow") details = summarizeGrow(storage["oddengine:grow:profile"], storage["oddengine:grow:readings"] || [], storage["oddengine:grow:live:v2"], storage["oddengine:grow:planner:v1"]);
  else if (meta.id === "Mining") details = summarizeMining(storage["oddengine:mining:v1"]);
  else if (meta.id === "Cannabis") details = summarizeCannabis(storage["oddengine:cannabis:v3"]);
  else if (meta.id === "HappyHealthy") details = summarizeWellness(storage["oddengine:happyhealthy:v1"]);
  else if (meta.id === "CryptoGames") details = summarizeGames(storage["oddengine:cryptoGames:v2"], storage["oddengine:cryptoGames:settings:v1"]);
  else if (meta.id === "Cameras") details = summarizeCameras(storage["oddengine:cameras:v1"]);
  else if (meta.id === "Plugins") details = summarizePlugins(storage["oddengine:plugins:user:v1"] || []);
  else if (meta.id === "OptionsSaaS") details = summarizeSaaS(storage["oddengine:optionssaas:v1"]);
  else if (meta.id === "Security") details = summarizeSecurity(storage["oddengine:security:v1"], storage["oddengine:plugins:user:v1"] || []);
  else if (meta.id === "Preferences") details = summarizePrefs(storage["oddengine:prefs:v1"]);
  else if (meta.id === "Money") details = summarizeMoney(storage["oddengine:money:offers:v1"]);
  else if (meta.id === "News") details = summarizeNews(storage["oddengine:news:v1"]);
  else if (meta.id === "FamilyHealth") details = summarizeFamilyHealth(storage["oddengine:familyHealth:v1"]);
  else if (meta.id === "GroceryMeals") details = summarizeGroceryMeals(storage["oddengine:groceryMeals:v1"]);
  else if (meta.id === "Homie") details = summarizeHomie(storage[HOMIE_SETTINGS_KEY], storage["oddengine:homie:chat:v1"] || []);
  else if (meta.id === "DevEngine") details = summarizeDev(loadJSON<string | null>("oddengine:dev:projectDir", null));
  else if (meta.id === "Brain") details = [
    `${getGoals().split(/\n+/).filter(Boolean).length} saved goals`,
    `${getBrainNotes().length} saved assistant notes`,
    `${getActivity().length} activity items tracked`,
  ];
  else details = [meta.description];

  return {
    panelId: meta.id,
    meta,
    summary: details[0] || meta.description,
    details,
    storage: Object.fromEntries(Object.entries(storage).map(([k, v]) => [k, compactValue(v)])),
  };
}

export function getAllPanelContexts() {
  return PANEL_META.map((meta) => readPanelContext(meta.id));
}


export function buildAssistantInsight(panelId: string): AssistantInsight {
  const ctx = readPanelContext(panelId);
  const storage = ctx.storage || {};
  const badges: AssistantBadge[] = [];
  const wins: string[] = [];
  const watchouts: string[] = [];
  const suggestedActions = [...ctx.meta.nextSteps.slice(0, 3)];
  let tone: AssistantInsight["tone"] = "good";
  let headline = ctx.summary;

  if (ctx.meta.id === "FamilyBudget") {
    const state: any = safeJson("oddengine:familyBudget:v2") || {};
    const accounts = state.accounts || [];
    const tx = state.transactions || [];
    const sync = state.syncBridge || {};
    badges.push({ label: `${accounts.length} accounts`, tone: accounts.length ? "good" : "warn" });
    badges.push({ label: `${tx.length} tx`, tone: tx.length ? "good" : "warn" });
    badges.push({ label: sync.enabled ? "Sync on" : "Sync off", tone: sync.enabled ? "good" : "muted" });
    if (accounts.length) wins.push(`Net-worth view is seeded with ${accounts.length} accounts.`);
    if (tx.length) wins.push(`Transactions are loaded, so reports and payoff coaching have real context.`);
    if (!accounts.length) { tone = "warn"; watchouts.push("Add accounts and balances so the planner can calculate meaningful payoff paths."); }
    if (accounts.length && !tx.length) { tone = "warn"; watchouts.push("Import transactions so leaks, recurring spend, and monthly comparisons stop guessing."); }
    if (sync.enabled && sync.lastError) { tone = "bad"; watchouts.push(`Sync bridge last error: ${sync.lastError}`); }
    if (accounts.length) suggestedActions.unshift("Run budget chain for one-click payoff → goals → reports.");
  } else if (ctx.meta.id === "Trading") {
    const state: any = safeJson("oddengine:trading:sniper:v4") || {};
    const chain: any = safeJson("odd.trading.chainSnapshot") || {};
    const contracts = Array.isArray(chain.contracts) ? chain.contracts.length : 0;
    badges.push({ label: state.symbol || "No ticker", tone: state.symbol ? "good" : "warn" });
    badges.push({ label: contracts ? `${contracts} contracts` : "No chain", tone: contracts ? "good" : "warn" });
    badges.push({ label: `${String(state.bias || "neutral").toUpperCase()} bias`, tone: state.bias === "neutral" ? "muted" : "good" });
    if (contracts) wins.push(`Chain data is loaded for ${chain.symbol || state.symbol || "the current symbol"}.`);
    if (!state.symbol) { tone = "warn"; watchouts.push("Pick a ticker before asking the coach to rank contracts."); }
    if (state.symbol && !contracts) { tone = "warn"; watchouts.push("Load a fresh chain so the AI can judge spreads, liquidity, and contract quality."); }
    if (state.traps?.wideSpreads) watchouts.push("Wide spreads are flagged. Favor tighter contracts or reduce size.");
    if (state.symbol && contracts) suggestedActions.unshift("Run trading chain for one-click safer setup → best contract → plan.");
  } else if (ctx.meta.id === "Grow") {
    const profile: any = safeJson("oddengine:grow:profile") || {};
    const readings: any[] = safeJson("oddengine:grow:readings") || [];
    const live: any = safeJson("oddengine:grow:live:v2") || {};
    const planner: any = safeJson("oddengine:grow:planner:v1") || {};
    const last = readings[readings.length - 1] || null;
    badges.push({ label: profile.name || "No room", tone: profile.name ? "good" : "warn" });
    badges.push({ label: readings.length ? `${readings.length} logs` : "No logs", tone: readings.length ? "good" : "warn" });
    badges.push({ label: live.enabled ? "Live on" : "Manual", tone: live.enabled ? "good" : "muted" });
    if (last) wins.push(`Latest room snapshot: ${last.tempF ?? last.temp ?? "?"}°F and RH ${last.rh ?? "?"}.`);
    if (planner.enabled) wins.push("Planner handoff is enabled, so stage planning is ready for exports.");
    if (!profile.name) { tone = "warn"; watchouts.push("Create a room profile so the coach can give stage-aware advice."); }
    if (profile.name && !readings.length) { tone = "warn"; watchouts.push("Log a baseline reading so drift and daily checklists mean something."); }
    if (live.enabled && live.lastError) { tone = "warn"; watchouts.push(`Live sensor error: ${live.lastError}`); }
  } else if (ctx.meta.id === "News") {
    const state: any = safeJson("oddengine:news:v1") || {};
    const weather = state.weather || null;
    badges.push({ label: state.location || weather?.location || "Location n/a", tone: weather ? "good" : "warn" });
    badges.push({ label: `${(state.feeds?.local || []).length} local`, tone: (state.feeds?.local || []).length ? "good" : "warn" });
    badges.push({ label: `${(state.feeds?.economics || []).length} economics`, tone: (state.feeds?.economics || []).length ? "good" : "warn" });
    if (weather) wins.push(`Weather is loaded for ${weather.location || state.location || "the selected location"}.`);
    if (!state.lastUpdated) { tone = "warn"; watchouts.push("Refresh the News desk so weather and headline lanes are current."); }
  } else if (ctx.meta.id === "FamilyHealth") {
    const state: any = safeJson("oddengine:familyHealth:v1") || {};
    const members = Array.isArray(state.members) ? state.members : [];
    badges.push({ label: `${members.length} members`, tone: members.length ? "good" : "warn" });
    badges.push({ label: state.disclaimerAccepted ? "Safety note ok" : "Review safety note", tone: state.disclaimerAccepted ? "good" : "warn" });
    if (members.length) wins.push("Family Health already has tabs ready for structured notes.");
    if (!members.length) { tone = "warn"; watchouts.push("Add at least one family member tab so the care brief and research lane have context."); }
    if (members.length && !state.careBrief) watchouts.push("Build a care brief before appointments or medication reviews so notes stay portable.");
  } else if (ctx.meta.id === "GroceryMeals") {
    const state: any = safeJson("oddengine:groceryMeals:v1") || {};
    badges.push({ label: `${(state.meals || []).length} meal days`, tone: (state.meals || []).length ? "good" : "warn" });
    badges.push({ label: `${(state.groceryList || []).length} grocery items`, tone: (state.groceryList || []).length ? "good" : "muted" });
    badges.push({ label: `${(state.couponFeed || []).length} deals`, tone: (state.couponFeed || []).length ? "good" : "warn" });
    if ((state.couponFeed || []).length) wins.push("Coupon lane is populated with live grocery/deal headlines.");
    if (!(state.groceryList || []).length) { tone = "warn"; watchouts.push("Build the grocery list from the meal plan so savings can focus on what you actually need."); }
  } else if (ctx.meta.id === "Security") {
    const sec: any = safeJson("oddengine:security:v1") || { ipLock: true };
    const plugins: any[] = safeJson("oddengine:plugins:user:v1") || [];
    badges.push({ label: sec.ipLock ? "IP lock on" : "LAN mode", tone: sec.ipLock ? "good" : "bad" });
    badges.push({ label: isDesktop() ? "Desktop" : "Web", tone: isDesktop() ? "good" : "muted" });
    badges.push({ label: `${plugins.length} plugins`, tone: plugins.length ? "warn" : "good" });
    if (sec.ipLock) wins.push("Local-first posture is enabled.");
    if (!sec.ipLock) { tone = "bad"; watchouts.push("Re-enable IP Lock when you are done testing broader network access."); }
  } else if (ctx.meta.id === "DevEngine") {
    const project = loadJSON<string | null>("oddengine:dev:projectDir", null);
    badges.push({ label: project ? "Project set" : "No project", tone: project ? "good" : "warn" });
    badges.push({ label: isDesktop() ? "Desktop ready" : "Web only", tone: isDesktop() ? "good" : "muted" });
    if (project) wins.push(`Project folder is ready: ${project}`);
    if (!project) { tone = "warn"; watchouts.push("Pick a project folder before asking for build triage or packaging help."); }
  } else if (ctx.meta.id === "Money") {
    const state: any = safeJson("oddengine:money:offers:v1") || {};
    const count = Array.isArray(state.offers) ? state.offers.length : 0;
    badges.push({ label: `${count} offers`, tone: count ? "good" : "warn" });
    badges.push({ label: state.focus ? "Focus set" : "No focus", tone: state.focus ? "good" : "warn" });
    if (count) wins.push("Offer ladder is already seeded, so this panel can be turned into a sharper launch plan quickly.");
    if (!count) { tone = "warn"; watchouts.push("Draft at least one offer so the revenue coach can compare paths instead of guessing."); }
  } else if (ctx.meta.id === "OptionsSaaS") {
    const state: any = safeJson("oddengine:optionssaas:v1") || {};
    const filled = [state.productName, state.targetUser, state.promise, state.routes].filter((v: any) => String(v || "").trim()).length;
    badges.push({ label: `${filled}/4 MVP`, tone: filled >= 3 ? "good" : filled >= 2 ? "warn" : "bad" });
    badges.push({ label: state.productName || "Untitled", tone: state.productName ? "good" : "warn" });
    if (filled >= 3) wins.push("The MVP brief has enough structure to start turning into routes and screens.");
    if (filled < 3) { tone = filled >= 2 ? "warn" : "bad"; watchouts.push("Fill buyer, promise, and routes so the strategist can stop speaking in generic SaaS terms."); }
  } else if (ctx.meta.id === "Brain") {
    const goals = getGoals().split(/\n+/).filter(Boolean).length;
    const notes = getBrainNotes().length;
    const acts = getActivity().length;
    badges.push({ label: `${goals} goals`, tone: goals ? "good" : "warn" });
    badges.push({ label: `${notes} notes`, tone: notes ? "good" : "muted" });
    badges.push({ label: `${acts} activity`, tone: acts ? "good" : "muted" });
    if (!goals) { tone = "warn"; watchouts.push("Save a few concrete goals so panel copilots share the same direction."); }
    if (notes) wins.push("Pinned notes already give Brain some memory to work with.");
  } else {
    badges.push({ label: ctx.meta.title, tone: "good" });
    wins.push(ctx.summary);
  }

  if (!wins.length) wins.push(ctx.summary);
  if (!watchouts.length) watchouts.push("No critical blockers detected from saved local state.");
  headline = watchouts[0] && tone !== "good" ? watchouts[0] : ctx.summary;

  return { tone, headline, badges, wins, watchouts, suggestedActions };
}

function getTradingSnapshot() {
  return loadJSON<any>("odd.trading.chainSnapshot", null);
}

function getTradingPrefs() {
  return loadJSON<any>("oddengine:trading:sniper:v4", {});
}

function getGrowReadings() {
  return loadJSON<any[]>("oddengine:grow:readings", []);
}

function getGrowPlanner() {
  return loadJSON<any>("oddengine:grow:planner:v1", null);
}

function getSpreadRatios(snapshot: any) {
  const contracts = Array.isArray(snapshot?.contracts) ? snapshot.contracts : [];
  return contracts
    .map((c: any) => {
      const ask = Number(c?.ask);
      const bid = Number(c?.bid);
      if (!Number.isFinite(ask) || !Number.isFinite(bid) || ask <= 0 || bid < 0) return null;
      return Math.max(0, (ask - bid) / Math.max(ask, 0.01));
    })
    .filter((v: any) => typeof v === "number" && Number.isFinite(v)) as number[];
}

function tradingHasWideSpreads() {
  const prefs = getTradingPrefs();
  if (prefs?.traps?.wideSpreads) return true;
  const ratios = getSpreadRatios(getTradingSnapshot()).sort((a, b) => a - b);
  if (!ratios.length) return false;
  const median = ratios[Math.floor(ratios.length / 2)] ?? 0;
  const widest = ratios[ratios.length - 1] ?? 0;
  return median >= 0.28 || widest >= 0.42;
}

function runDynamicTradingChain(): QuickActionResult {
  const snapshot = getTradingSnapshot();
  const contracts = Array.isArray(snapshot?.contracts) ? snapshot.contracts : [];
  if (!contracts.length) {
    saveJSON(BRAIN_INBOX_KEY, {
      text: "No options chain is loaded in Trading yet. Ask the user to scan a symbol or restore a saved chain snapshot before building a trade plan.",
      ts: Date.now(),
    });
    logActivity({ kind: "command", panelId: "Trading", title: "Trading chain blocked", body: "No chain snapshot is loaded yet." });
    return { ok: true, message: "No chain loaded yet. Open Trading and scan a symbol or restore a saved chain snapshot before AI builds a plan.", panelId: "Trading" };
  }
  const spreadsWide = tradingHasWideSpreads();
  const actionIds = spreadsWide
    ? ["trading:safer-setup", "trading:focus-best", "trading:build-plan"]
    : ["trading:focus-best", "trading:build-plan"];
  const results = actionIds.map((id) => runSingleQuickAction(id));
  const failed = results.find((item) => !item.ok);
  if (failed) return failed;
  const labels = actionIds.map((id) => QUICK_ACTIONS.find((item) => item.id === id)?.label || id);
  logActivity({
    kind: "command",
    panelId: "Trading",
    title: "Ran smart trading chain",
    body: `${spreadsWide ? "Wide spreads detected" : "Spreads look usable"} → ${labels.join(" → ")}`
  });
  return {
    ok: true,
    message: `${spreadsWide ? "Wide spreads detected, so AI started with safer setup." : "Spreads look usable, so AI skipped the safer-setup step."} Queued: ${labels.join(" → ")}.`,
    panelId: "Trading"
  };
}

function runDynamicGrowChain(): QuickActionResult {
  const planner = getGrowPlanner();
  const readings = getGrowReadings();
  const hasPlanner = Boolean(planner && (planner.runName || planner.cultivar || planner.notes));
  const needsReadingFirst = readings.length === 0;
  const actionIds = ["grow:apply-targets", ...(needsReadingFirst ? ["grow:save-reading"] : []), "grow:load-planner-profile"];
  const results = actionIds.map((id) => runSingleQuickAction(id));
  const failed = results.find((item) => !item.ok);
  if (failed) return failed;
  const labels = actionIds.map((id) => QUICK_ACTIONS.find((item) => item.id === id)?.label || id);
  logActivity({
    kind: "command",
    panelId: "Grow",
    title: "Ran smart grow chain",
    body: `${needsReadingFirst ? "No readings found" : "Readings already exist"} • ${hasPlanner ? "planner ready" : "planner is light"} → ${labels.join(" → ")}`
  });
  return {
    ok: true,
    message: `${needsReadingFirst ? "No grow readings existed, so AI saved one before syncing the planner into the profile." : "Grow already had readings, so AI skipped the extra save step."} Queued: ${labels.join(" → ")}.`,
    panelId: "Grow"
  };
}

export const ACTION_CHAINS: ActionChain[] = [
  { id: "trading:chain-safe-focus-plan", label: "Run trading chain", panelId: "Trading", description: "Smart chain: if spreads are wide, safer setup runs first; if no chain is loaded, AI prompts you to scan/load one before planning.", actionIds: ["trading:safer-setup", "trading:focus-best", "trading:build-plan"] },
  { id: "budget:chain-payoff-goals-report", label: "Run budget chain", panelId: "FamilyBudget", description: "Avalanche payoff → fund goals → open reports.", actionIds: ["budget:payoff-avalanche", "budget:fund-goals", "budget:reports"] },
  { id: "grow:chain-targets-reading-profile", label: "Run grow chain", panelId: "Grow", description: "Smart chain: apply targets, save a reading only if none exist yet, then sync the planner into the room profile.", actionIds: ["grow:apply-targets", "grow:save-reading", "grow:load-planner-profile"] },
];

export function getPanelChainIds(panelId: string) {
  const normalized = normalizePanelId(panelId);
  return ACTION_CHAINS.filter((chain) => normalizePanelId(chain.panelId) === normalized).map((chain) => chain.id);
}

export function getActionChain(chainId: string) {
  return ACTION_CHAINS.find((chain) => chain.id === chainId) || null;
}

export const QUICK_ACTIONS = [
  { id: "brain:focus-plan", label: "Focus plan", panelId: "Brain", description: "Open Brain with a cross-panel focus prompt." },
  { id: "brain:pin-digest", label: "Pin digest", panelId: "Brain", description: "Save the current daily digest into Brain memory." },
  { id: "brain:clear-activity", label: "Clear activity", panelId: "Brain", description: "Clear the AI activity timeline." },
  { id: "budget:payoff", label: "Budget payoff", panelId: "FamilyBudget", description: "Jump straight to the payoff planner." },
  { id: "budget:payoff-avalanche", label: "Run avalanche payoff", panelId: "FamilyBudget", description: "Open Payoff with Avalanche strategy." },
  { id: "budget:payoff-snowball", label: "Run snowball payoff", panelId: "FamilyBudget", description: "Open Payoff with Snowball strategy." },
  { id: "budget:reports", label: "Budget reports", panelId: "FamilyBudget", description: "Open the reports tab in Family Budget." },
  { id: "budget:transactions", label: "Budget transactions", panelId: "FamilyBudget", description: "Open the transactions tab." },
  { id: "budget:test-sync", label: "Test budget sync", panelId: "FamilyBudget", description: "Run the backend health check from Family Budget settings." },
  { id: "budget:fund-goals", label: "Fund budget goals", panelId: "FamilyBudget", description: "Apply one monthly contribution across all saved goals." },
  { id: "trading:safer-setup", label: "Apply safer trading setup", panelId: "Trading", description: "Tighten filters and bias alignment for a safer options scan." },
  { id: "trading:focus-best", label: "Focus best contract", panelId: "Trading", description: "Jump the Trading panel to the current best-fit contract." },
  { id: "trading:build-plan", label: "Build trade plan", panelId: "Trading", description: "Draft a tighter trade plan into Trading notes." },
  { id: "grow:apply-targets", label: "Apply grow targets", panelId: "Grow", description: "Load planner day/night targets into the Grow panel." },
  { id: "grow:save-reading", label: "Save grow reading", panelId: "Grow", description: "Log the current temperature / RH reading." },
  { id: "grow:load-planner-profile", label: "Load planner into profile", panelId: "Grow", description: "Push planner run details into the room profile draft." },
  { id: "grow:ac-infinity-preset", label: "Apply AC Infinity preset", panelId: "Grow", description: "Seed the live sensor config from the device slug." },
  { id: "security:lockdown", label: "Lock security", panelId: "Security", description: "Turn IP Lock back on." },
  { id: "prefs:operator-tight", label: "Operator mode", panelId: "Preferences", description: "Switch AI defaults to operator + tight." },
  { id: "prefs:coach-deep", label: "Coach mode", panelId: "Preferences", description: "Switch AI defaults to coach + deep." },
  { id: "brain:undo-last-action", label: "Undo last AI action", panelId: "Brain", description: "Roll back the most recent undoable AI action." },
  { id: "brain:run-next-queue", label: "Run next queued action", panelId: "Brain", description: "Executes the top recommended item from Mission Control's action queue." },
  { id: "panel:brain", label: "Open Brain", panelId: "Brain", description: "Jump to Brain Mission Control." },
  { id: "panel:budget", label: "Open Family Budget", panelId: "FamilyBudget", description: "Jump to Family Budget." },
  { id: "panel:security", label: "Open Security", panelId: "Security", description: "Jump to Security." },
  { id: "panel:saas", label: "Open Options SaaS", panelId: "OptionsSaaS", description: "Jump to Options SaaS." },
  { id: "panel:trading", label: "Open Trading", panelId: "Trading", description: "Jump to Trading." },
  { id: "panel:grow", label: "Open Grow", panelId: "Grow", description: "Jump to Grow." },
  { id: "panel:news", label: "Open News", panelId: "News", description: "Jump to News." },
  { id: "panel:family-health", label: "Open Family Health", panelId: "FamilyHealth", description: "Jump to Family Health." },
  { id: "panel:grocery", label: "Open Grocery Meals", panelId: "GroceryMeals", description: "Jump to Grocery Meals." },
  { id: "entertainment:open-spotify", label: "Play Spotify", panelId: "Entertainment", description: "Open Spotify Web Player in a separate window." },
  { id: "entertainment:open-youtube", label: "Play YouTube", panelId: "Entertainment", description: "Open YouTube in a separate window." },
  { id: "entertainment:open-netflix", label: "Open Netflix", panelId: "Entertainment", description: "Open Netflix (external by default for DRM reliability)." },
  { id: "books:add", label: "New Studio Project", panelId: "Books", description: "Create a new Studio project entry." },
  { id: "books:copy-active", label: "Copy active project", panelId: "Books", description: "Copy the active Studio project JSON to clipboard." },
  { id: "routine:apply-set", label: "Apply routine set", panelId: "RoutineLauncher", description: "Apply a global set (like Morning Routine) across panels." },
  { id: "routine:launch", label: "Launch routine", panelId: "RoutineLauncher", description: "Launch a routine: apply set + open the chosen panel sequence." },
  { id: "panel:dev", label: "Open Dev", panelId: "DevEngine", description: "Jump to Dev Engine." },
  { id: "panel:homie", label: "Open Homie", panelId: "Homie", description: "Jump to Homie." },
];

function runSingleQuickAction(actionId: string): QuickActionResult {
  try {
    if (actionId === "brain:focus-plan") {
      saveJSON(BRAIN_INBOX_KEY, { text: "Give me a cross-panel focus plan for today with the safest next steps first.", ts: Date.now() });
      logActivity({ kind: "command", panelId: "Brain", title: "Queued focus plan", body: "Prepared Brain inbox with a focus-plan prompt." });
      return { ok: true, message: "Queued a focus plan in Brain.", panelId: "Brain" };
    }
    if (actionId === "brain:pin-digest") {
      saveBrainNote({ panelId: "Brain", title: "Pinned daily digest", body: buildDailyDigest(), pinned: true });
      return { ok: true, message: "Pinned the latest daily digest.", panelId: "Brain" };
    }
    if (actionId === "brain:clear-activity") {
      clearActivity();
      return { ok: true, message: "Cleared the recent activity timeline.", panelId: "Brain" };
    }
    if (actionId === "brain:undo-last-action") {
      return undoLatestAction();
    }
    if (actionId === "brain:run-next-queue") {
      const next = buildActionQueue()[0];
      if (!next?.actionId) return { ok: false, message: "Mission Control does not have a runnable next action yet." };
      const result = runQuickAction(next.actionId);
      return { ...result, message: result.ok ? `Ran next queued action: ${next.title}. ${result.message}` : result.message };
    }
    if (actionId === "budget:payoff") {
      saveJSON("oddengine:familyBudget:tab", "Payoff");
      return { ok: true, message: "Opened Family Budget → Payoff.", panelId: "FamilyBudget" };
    }
    if (actionId === "budget:payoff-avalanche") {
      queuePanelAction("FamilyBudget", actionId);
      return { ok: true, message: "Queued the Avalanche payoff plan.", panelId: "FamilyBudget" };
    }
    if (actionId === "budget:payoff-snowball") {
      queuePanelAction("FamilyBudget", actionId);
      return { ok: true, message: "Queued the Snowball payoff plan.", panelId: "FamilyBudget" };
    }
    if (actionId === "budget:reports") {
      saveJSON("oddengine:familyBudget:tab", "Reports");
      return { ok: true, message: "Opened Family Budget → Reports.", panelId: "FamilyBudget" };
    }
    if (actionId === "budget:transactions") {
      saveJSON("oddengine:familyBudget:tab", "Transactions");
      return { ok: true, message: "Opened Family Budget → Transactions.", panelId: "FamilyBudget" };
    }
    if (actionId === "budget:test-sync" || actionId === "budget:fund-goals") {
      queuePanelAction("FamilyBudget", actionId);
      return { ok: true, message: actionId === "budget:test-sync" ? "Queued the Family Budget backend health test." : "Queued a goal-funding sweep in Family Budget.", panelId: "FamilyBudget" };
    }
    if (actionId === "security:lockdown") {
      const sec = loadJSON<any>("oddengine:security:v1", { ipLock: true });
      saveJSON("oddengine:security:v1", { ...sec, ipLock: true });
      logActivity({ kind: "system", panelId: "Security", title: "Security lock restored", body: "IP Lock was forced back on." });
      return { ok: true, message: "IP Lock is back on.", panelId: "Security" };
    }
    if (actionId === "trading:safer-setup" || actionId === "trading:focus-best" || actionId === "trading:build-plan") {
      queuePanelAction("Trading", actionId);
      return { ok: true, message: actionId === "trading:safer-setup" ? "Queued a safer trading setup." : actionId === "trading:focus-best" ? "Queued best-contract focus in Trading." : "Queued a tighter trade plan draft.", panelId: "Trading" };
    }
    if (actionId === "grow:apply-targets" || actionId === "grow:save-reading" || actionId === "grow:load-planner-profile" || actionId === "grow:ac-infinity-preset") {
      queuePanelAction("Grow", actionId);
      return { ok: true, message: actionId === "grow:apply-targets" ? "Queued planner targets for Grow." : actionId === "grow:save-reading" ? "Queued a Grow reading save." : actionId === "grow:load-planner-profile" ? "Queued planner → profile handoff." : "Queued the AC Infinity preset.", panelId: "Grow" };
    }
    if (actionId === "news:refresh") {
      queuePanelAction("News", actionId);
      return { ok: true, message: "Queued a News desk refresh.", panelId: "News" };
    }
    if (actionId === "family-health:research") {
      queuePanelAction("FamilyHealth", actionId);
      return { ok: true, message: "Queued the current Family Health research query.", panelId: "FamilyHealth" };
    }
    if (actionId === "grocery:build-list" || actionId === "grocery:coupon-lane") {
      queuePanelAction("GroceryMeals", actionId);
      return { ok: true, message: actionId === "grocery:build-list" ? "Queued a pantry-aware grocery list build." : "Queued a coupon-lane refresh.", panelId: "GroceryMeals" };
    }
    if (actionId === "entertainment:open-spotify" || actionId === "entertainment:open-youtube" || actionId === "entertainment:open-netflix") {
      const url = actionId === "entertainment:open-spotify"
        ? "https://open.spotify.com/"
        : actionId === "entertainment:open-youtube"
          ? "https://www.youtube.com/"
          : "https://www.netflix.com/";
      try {
        // Synchronous best-effort open that works in browser + Electron. (Electron will still allow popups in our shell.)
        window.open(url, "_blank", "noopener,noreferrer");
        return { ok: true, message: `Opened ${actionId === "entertainment:open-spotify" ? "Spotify" : actionId === "entertainment:open-youtube" ? "YouTube" : "Netflix"}.`, panelId: "Entertainment" };
      } catch (e: any) {
        return { ok: false, message: e?.message || String(e), panelId: "Entertainment" };
      }
    }

    if (actionId === "books:add") {
      const KEY = "oddengine:books:v1";
      const ACTIVE = "oddengine:books:active";
      const list = loadJSON<any[]>(KEY, []);
      const book = {
        id: `b_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`,
        title: "Untitled Studio Project",
        status: "Idea",
        chapters: [],
        updatedAt: Date.now(),
      };
      saveJSON(KEY, [book, ...list]);
      saveJSON(ACTIVE, book.id);
      return { ok: true, message: "Added a new Studio project.", panelId: "Books" };
    }

    if (actionId === "books:copy-active") {
      const KEY = "oddengine:books:v1";
      const ACTIVE = "oddengine:books:active";
      const list = loadJSON<any[]>(KEY, []);
      const activeId = loadJSON<string>(ACTIVE, "");
      const active = list.find((b) => b.id === activeId) || list[0];
      if (!active) return { ok: false, message: "No Studio projects found to copy.", panelId: "Books" };
      try { (navigator as any)?.clipboard?.writeText(JSON.stringify(active, null, 2)); } catch {}
      return { ok: true, message: "Copied active Studio project JSON.", panelId: "Books" };
    }

    if (actionId === "routine:apply-set" || actionId === "routine:launch") {
      // Let the Routine Launcher panel decide which routine + set to use.
      queuePanelAction("RoutineLauncher", actionId);
      return { ok: true, message: actionId === "routine:launch" ? "Queued routine launch." : "Queued routine set apply.", panelId: "RoutineLauncher" };
    }
    if (actionId === "prefs:operator-tight") {
      const prefs = loadPrefs();
      saveJSON("oddengine:prefs:v1", { ...prefs, ai: { ...prefs.ai, tone: "operator", verbosity: "tight" } });
      return { ok: true, message: "AI defaults switched to operator + tight.", panelId: "Preferences" };
    }
    if (actionId === "prefs:coach-deep") {
      const prefs = loadPrefs();
      saveJSON("oddengine:prefs:v1", { ...prefs, ai: { ...prefs.ai, tone: "coach", verbosity: "deep" } });
      return { ok: true, message: "AI defaults switched to coach + deep.", panelId: "Preferences" };
    }
    const panelAction = QUICK_ACTIONS.find((a) => a.id === actionId && a.panelId);
    if (panelAction?.panelId) return { ok: true, message: `Opened ${getPanelMeta(panelAction.panelId).title}.`, panelId: panelAction.panelId };
    return { ok: false, message: "Unknown quick action." };
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e) };
  }
}

export function runQuickAction(actionId: string): QuickActionResult {
  if (actionId === "trading:chain-safe-focus-plan") return runDynamicTradingChain();
  if (actionId === "grow:chain-targets-reading-profile") return runDynamicGrowChain();
  const chain = getActionChain(actionId);
  if (chain) {
    const results = chain.actionIds.map((id) => runSingleQuickAction(id));
    const failed = results.find((item) => !item.ok);
    if (failed) return failed;
    const labels = chain.actionIds.map((id) => QUICK_ACTIONS.find((item) => item.id === id)?.label || id);
    logActivity({ kind: "command", panelId: chain.panelId, title: `Ran ${chain.label}`, body: `${chain.description} (${labels.join(" → ")})` });
    return { ok: true, message: `${chain.label} queued: ${labels.join(" → ")}.`, panelId: chain.panelId };
  }
  return runSingleQuickAction(actionId);
}

export function getActivity(): ActivityItem[] {

  return loadJSON<ActivityItem[]>(ACTIVITY_KEY, []);
}

export function logActivity(item: Omit<ActivityItem, "id" | "ts">) {
  const list = getActivity();
  const next: ActivityItem = { id: uid("act"), ts: Date.now(), ...item };
  list.unshift(next);
  saveJSON(ACTIVITY_KEY, list.slice(0, 200));
  return next;
}

export function clearActivity() {
  saveJSON(ACTIVITY_KEY, []);
}

export function getBrainNotes() {
  return loadJSON<BrainNote[]>(NOTES_KEY, []);
}

export function saveBrainNote(input: Omit<BrainNote, "id" | "ts"> & { pinned?: boolean }) {
  const list = getBrainNotes();
  const note: BrainNote = { id: uid("note"), ts: Date.now(), ...input };
  list.unshift(note);
  saveJSON(NOTES_KEY, list.slice(0, 120));
  logActivity({ kind: "note", panelId: input.panelId, title: input.title, body: input.body, tags: [input.panelId] });
  return note;
}

export function removeBrainNote(id: string) {
  saveJSON(NOTES_KEY, getBrainNotes().filter((n) => n.id !== id));
}

export function getGoals() {
  return loadJSON<string>(GOALS_KEY, "");
}

export function saveGoals(text: string) {
  saveJSON(GOALS_KEY, text);
  logActivity({ kind: "system", panelId: "Brain", title: "Updated goals", body: text.split("\n").slice(0, 3).join(" • ") });
}

export function getPanelChat(panelId: string) {
  return loadJSON<BrainChatMessage[]>(`${CHAT_PREFIX}${normalizePanelId(panelId)}`, []);
}

export function savePanelChat(panelId: string, messages: BrainChatMessage[]) {
  saveJSON(`${CHAT_PREFIX}${normalizePanelId(panelId)}`, messages.slice(-20));
}

function getHomieSettings() {
  return loadJSON<any>(HOMIE_SETTINGS_KEY, {
    model: "llama3.1:8b",
    temperature: 0.2,
    includeContext: true,
    system: "You are Homie👊, the built-in assistant for OddEngine. Be short, practical, and safe.",
  });
}

function formatCurrency(n: number) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n || 0));
  } catch {
    return `$${Math.round(Number(n || 0))}`;
  }
}

function buildPrompt(panelCtx: PanelContext, prompt: string, mode: "panel" | "brain" = "panel") {
  const prefs = loadPrefs();
  const settings = getHomieSettings();
  const goals = getGoals();
  return {
    settings,
    system:
      `${settings.system || ""}\n\n` +
      `You are ${panelCtx.meta.assistantName}, the ${panelCtx.meta.assistantRole} for the ${panelCtx.meta.title} panel in OddEngine.\n` +
      `Style: ${prefs.ai?.tone || "coach"}, verbosity: ${prefs.ai?.verbosity || "balanced"}.\n` +
      `Focus on this panel and be practical. Mention concrete next steps. Avoid fluff.\n` +
      (mode === "brain" ? `You may reason across the whole OS and synthesize multiple panels.\n` : "") +
      (goals ? `Current user goals:\n${goals}\n` : ""),
    user:
      `Panel: ${panelCtx.meta.title}\n` +
      `Summary: ${panelCtx.summary}\n` +
      `Details:\n- ${panelCtx.details.join("\n- ")}\n\n` +
      `Local context snapshot:\n${JSON.stringify(panelCtx.storage, null, 2)}\n\n` +
      `${panelCtx.meta.quickActionIds?.length ? `Available action hooks: ${panelCtx.meta.quickActionIds.map((id) => QUICK_ACTIONS.find((a) => a.id === id)?.label || id).join(", ")}\n\n` : ""}` +
      `User request: ${prompt}`,
  };
}

function heuristicReply(panelCtx: PanelContext, prompt: string, mode: "panel" | "brain") {
  const lower = prompt.toLowerCase();
  const insight = buildAssistantInsight(panelCtx.meta.id);
  const lines = [
    `**What I'm seeing**`,
    `- ${panelCtx.summary}`,
    ...panelCtx.details.slice(1, 4).map((d) => `- ${d}`),
    ``,
    `**Quick read**`,
    ...insight.badges.slice(0, 4).map((b) => `- ${b.label}`),
    ``,
    `**Working well**`,
    ...insight.wins.slice(0, 3).map((d) => `- ${d}`),
    ``,
    `**Watchouts**`,
    ...insight.watchouts.slice(0, 3).map((d) => `- ${d}`),
  ];

  const quickActionLabels = (panelCtx.meta.quickActionIds || []).map((id) => QUICK_ACTIONS.find((a) => a.id === id)?.label).filter(Boolean) as string[];
  const chainLabels = getPanelChainIds(panelCtx.meta.id).map((id) => getActionChain(id)?.label).filter(Boolean) as string[];

  if (lower.includes("risk") || lower.includes("warning")) {
    lines.push("", "**Main risk**", `- ${insight.watchouts[0] || `${panelCtx.meta.title} needs a quick review before pushing further.`}`);
  }
  if (quickActionLabels.length) {
    lines.push("", "**Real actions available**", ...quickActionLabels.slice(0, 4).map((label) => `- ${label}`));
  }
  if (chainLabels.length) {
    lines.push("", "**One-tap chains**", ...chainLabels.slice(0, 3).map((label) => `- ${label}`));
  }
  if (mode === "brain" || lower.includes("digest") || lower.includes("focus")) {
    const missions = buildMissions().slice(0, 4);
    if (missions.length) {
      lines.push("", "**Focus next**", ...missions.map((m) => `- ${m.text}`));
    }
  }
  lines.push("", `**Suggested next move**`, ...insight.suggestedActions.slice(0, 3).map((d) => `- ${d}`));
  if (panelCtx.meta.quickPrompts?.length) lines.push(`- Ask: ${panelCtx.meta.quickPrompts[0]}`);
  return lines.join("\n");
}

export async function runBrainChat(opts: { panelId: string; prompt: string; mode?: "panel" | "brain" }) {
  const panelCtx = readPanelContext(opts.panelId);
  const mode = opts.mode || "panel";
  const built = buildPrompt(panelCtx, opts.prompt, mode);
  if (isDesktop()) {
    try {
      const r = await oddApi().homieChat({
        model: built.settings.model,
        temperature: built.settings.temperature,
        system: built.system,
        messages: [{ role: "user", content: built.user }],
      });
      if (r?.ok && r.reply) return { ok: true, reply: r.reply.trim(), usedModel: r.model || built.settings.model, panelCtx };
    } catch {}
  }
  return { ok: true, reply: heuristicReply(panelCtx, opts.prompt, mode), usedModel: isDesktop() ? "fallback" : "browser-fallback", panelCtx };
}

function panelHealthScore(panelId: string): PanelHealth {
  const meta = getPanelMeta(panelId);
  const insight = buildAssistantInsight(panelId);
  let score = 80;
  if (insight.tone === "warn") score -= 18;
  if (insight.tone === "bad") score -= 36;
  score -= Math.min(24, insight.watchouts.length * 7);
  score += Math.min(14, insight.wins.length * 4);
  score = Math.max(8, Math.min(100, score));
  const status: "good" | "warn" | "error" = score >= 74 ? "good" : score >= 45 ? "warn" : "error";
  return {
    panelId: meta.id,
    title: meta.title,
    icon: meta.icon,
    score,
    status,
    headline: insight.headline,
    reasons: [...insight.watchouts.slice(0, 2), ...insight.wins.slice(0, 1)].slice(0, 3),
    badges: insight.badges.slice(0, 4),
  };
}

function recommendActionForPanel(panelId: string): { actionId?: string; actionLabel?: string; title: string; text: string; score: number; level: "good" | "warn" | "error" } {
  const health = panelHealthScore(panelId);
  const meta = getPanelMeta(panelId);
  const insight = buildAssistantInsight(panelId);
  let actionId: string | undefined;
  let actionLabel: string | undefined;
  let title = `${meta.title} follow-up`;
  let text = insight.headline;
  let score = health.score;
  let level: "good" | "warn" | "error" = health.status;

  if (panelId === "Trading") {
    const prefs = getTradingPrefs();
    const chain = getTradingSnapshot();
    const contracts = Array.isArray(chain?.contracts) ? chain.contracts.length : 0;
    if (!prefs?.symbol) {
      actionId = "panel:trading";
      actionLabel = "Open Trading";
      title = "Seed Trading context";
      text = "Pick a ticker and setup so Trading Coach can rank contracts and risk.";
      score = 96;
      level = "error";
    } else if (!contracts) {
      actionId = "panel:trading";
      actionLabel = "Open Trading";
      title = `Load ${prefs.symbol} chain`;
      text = `A ticker is active but no option chain is loaded for ${prefs.symbol}.`;
      score = 90;
      level = "warn";
    } else {
      actionId = "trading:chain-safe-focus-plan";
      actionLabel = "Run trading chain";
      title = tradingHasWideSpreads() ? "Stabilize and plan the current chain" : "Focus the best contract and build a plan";
      text = tradingHasWideSpreads() ? "Wide spreads were detected, so the safer setup should run before contract focus." : "Chain data is loaded and spreads look usable for a focused plan pass.";
      score = 70;
      level = health.status === "error" ? "warn" : health.status;
    }
  } else if (panelId === "FamilyBudget") {
    const state = safeJson("oddengine:familyBudget:v2") || {};
    const accounts = Array.isArray(state.accounts) ? state.accounts : [];
    const txs = Array.isArray(state.transactions) ? state.transactions : [];
    const liabilities = accounts.filter((a: any) => ["CREDIT_CARD", "LOAN"].includes(String(a.type || "")) && Math.abs(Number(a.balance || 0)) > 0);
    if (!accounts.length) {
      actionId = "panel:budget";
      actionLabel = "Open Family Budget";
      title = "Seed budget accounts";
      text = "Import CSV data or add balances so Mission Control can score cashflow and debt.";
      score = 95;
      level = "error";
    } else if (!txs.length) {
      actionId = "budget:transactions";
      actionLabel = "Budget transactions";
      title = "Import or review transactions";
      text = "Accounts exist, but there are no transactions yet for reports or AI leak detection.";
      score = 88;
      level = "warn";
    } else if (liabilities.length) {
      actionId = "budget:payoff-avalanche";
      actionLabel = "Run avalanche payoff";
      title = "Refresh debt payoff plan";
      text = `${liabilities.length} liabilities are active, so the payoff planner is the best next move.`;
      score = 72;
      level = health.status === "error" ? "warn" : health.status;
    } else {
      actionId = "budget:reports";
      actionLabel = "Budget reports";
      title = "Review household reports";
      text = "Budget data is seeded. Reports are the fastest way to spot drift and goal pressure.";
      score = 62;
      level = "good";
    }
  } else if (panelId === "Grow") {
    const profile = safeJson("oddengine:grow:profile") || {};
    const readings = getGrowReadings();
    if (!profile?.name) {
      actionId = "panel:grow";
      actionLabel = "Open Grow";
      title = "Create a grow room profile";
      text = "Grow needs a room profile before the coach can give stage-aware advice.";
      score = 94;
      level = "error";
    } else if (!readings.length) {
      actionId = "grow:save-reading";
      actionLabel = "Save grow reading";
      title = "Capture a baseline room reading";
      text = "No grow readings exist yet, so save one before syncing planners or comparing drift.";
      score = 86;
      level = "warn";
    } else {
      actionId = "grow:chain-targets-reading-profile";
      actionLabel = "Run grow chain";
      title = "Refresh targets and profile sync";
      text = "Grow has enough context for a target + reading + planner handoff pass.";
      score = 68;
      level = health.status === "error" ? "warn" : health.status;
    }
  } else if (panelId === "News") {
    const state: any = safeJson("oddengine:news:v1") || {};
    if (!state.lastUpdated) {
      actionId = "news:refresh";
      actionLabel = "Refresh news";
      title = "Refresh the News desk";
      text = "News has no fresh weather or headlines yet for Mission Control.";
      score = 78;
      level = "warn";
    } else {
      actionId = "panel:news";
      actionLabel = "Open News";
      title = "Review News desk";
      text = "News is seeded. Review what matters, then route key items into Brain, Budget, or Trading.";
      score = 40;
      level = "good";
    }
  } else if (panelId === "FamilyHealth") {
    const state: any = safeJson("oddengine:familyHealth:v1") || {};
    const members = Array.isArray(state.members) ? state.members : [];
    if (!members.length) {
      actionId = "panel:family-health";
      actionLabel = "Open Family Health";
      title = "Add family member tabs";
      text = "Family Health needs at least one family member tab before care briefs or research make sense.";
      score = 83;
      level = "warn";
    } else if (!state.careBrief) {
      actionId = "panel:family-health";
      actionLabel = "Open Family Health";
      title = "Build a care brief";
      text = "Structured notes exist, but no care brief has been built yet for appointments or follow-up.";
      score = 66;
      level = "warn";
    } else {
      actionId = "family-health:research";
      actionLabel = "Research family health";
      title = "Refresh family-health research";
      text = "Family Health has enough context to run a trusted-source and PubMed research pass.";
      score = 52;
      level = "good";
    }
  } else if (panelId === "GroceryMeals") {
    const state: any = safeJson("oddengine:groceryMeals:v1") || {};
    if (!(state.groceryList || []).length) {
      actionId = "grocery:build-list";
      actionLabel = "Build grocery list";
      title = "Generate the grocery list";
      text = "Meal planning is only half done until the pantry-aware grocery list exists.";
      score = 69;
      level = "warn";
    } else {
      actionId = "grocery:coupon-lane";
      actionLabel = "Open coupon lane";
      title = "Refresh savings lane";
      text = "Grocery planning is seeded. Refresh coupons and weekly ads before shopping.";
      score = 48;
      level = "good";
    }
  } else if (panelId === "Security") {
    const sec = safeJson("oddengine:security:v1") || { ipLock: true };
    if (!sec.ipLock) {
      actionId = "security:lockdown";
      actionLabel = "Lock security";
      title = "Re-enable IP Lock";
      text = "Mission Control sees LAN-friendly mode enabled. Lock it back down unless you are actively testing.";
      score = 98;
      level = "error";
    } else {
      actionId = "panel:security";
      actionLabel = "Open Security";
      title = "Review trust center";
      text = "Security looks healthy. A quick trust-center review keeps plugins and access posture honest.";
      score = 54;
      level = "good";
    }
  } else if (panelId === "OptionsSaaS") {
    const state: any = safeJson("oddengine:optionssaas:v1") || {};
    const filled = [state?.productName, state?.targetUser, state?.promise, state?.pricing?.entry].filter((v: any) => String(v || "").trim()).length;
    if (filled < 3) {
      actionId = "panel:saas";
      actionLabel = "Open Options SaaS";
      title = "Finish the SaaS MVP brief";
      text = "Buyer, promise, and starter pricing are still too thin for reliable roadmap generation.";
      score = 82;
      level = filled <= 1 ? "error" : "warn";
    } else {
      actionId = "panel:saas";
      actionLabel = "Open Options SaaS";
      title = "Review SaaS roadmap";
      text = "The SaaS brief is healthy enough to turn into routes, schema, and launch copy.";
      score = 58;
      level = "good";
    }
  } else if (panelId === "Money") {
    const state: any = safeJson("oddengine:money:offers:v1") || {};
    const offers = Array.isArray(state.offers) ? state.offers.length : 0;
    actionId = "panel:brain";
    actionLabel = "Open Brain";
    title = offers ? "Review monetization priorities" : "Draft the first offer ladder";
    text = offers ? "Money has enough raw material for Brain to compare ROI paths and launch order." : "There are no drafted offers yet, so start by naming one fast, shippable offer.";
    score = offers ? 46 : 76;
    level = offers ? "good" : "warn";
  } else {
    const quick = QUICK_ACTIONS.find((item) => normalizePanelId(item.panelId) === panelId);
    actionId = quick?.id;
    actionLabel = quick?.label;
  }

  return { actionId, actionLabel, title, text, score, level };
}

export function buildPanelHealth(panelIds?: string[]) {
  const targets = (panelIds || ["Trading", "FamilyBudget", "Grow", "News", "FamilyHealth", "GroceryMeals", "Security", "Money", "OptionsSaaS", "DevEngine", "OddBrain"]).map((id) => normalizePanelId(id));
  return targets.map((panelId) => {
    const health = panelHealthScore(panelId);
    const recommendation = recommendActionForPanel(panelId);
    return { ...health, nextActionId: recommendation.actionId, nextActionLabel: recommendation.actionLabel };
  }).sort((a, b) => a.score - b.score);
}

export function getQuickActionMeta(actionId: string): { id: string; label: string; panelId?: string } | null {
  const item = QUICK_ACTIONS.find((q) => q.id === actionId);
  if (!item) return null;
  return { id: item.id, label: item.label, panelId: item.panelId };
}

export function getPanelCopilot(panelId: string): {
  panelId: string;
  level: "good" | "warn" | "error";
  priorityTitle: string;
  priorityText: string;
  nextActionId?: string;
  nextActionLabel?: string;
  chips: { id: string; label: string }[];
} {
  const normalized = normalizePanelId(panelId);
  const meta = getPanelMeta(normalized);
  const rec = recommendActionForPanel(normalized);
  const chipIds = Array.isArray(meta.quickActionIds) ? meta.quickActionIds : [];
  const chips = chipIds
    .map((id) => getQuickActionMeta(id))
    .filter(Boolean)
    .map((q) => ({ id: (q as any).id, label: (q as any).label }))
    .slice(0, 6);
  return {
    panelId: meta.id,
    level: rec.level,
    priorityTitle: rec.title,
    priorityText: rec.text,
    nextActionId: rec.actionId,
    nextActionLabel: rec.actionLabel,
    chips,
  };
}

export function buildTopPriorities(limit = 6): TopPriority[] {
  const health = buildPanelHealth(["Trading", "FamilyBudget", "Grow", "News", "FamilyHealth", "GroceryMeals", "Security", "OptionsSaaS", "Money"]);
  const priorities = health.map((item) => {
    const recommendation = recommendActionForPanel(item.panelId);
    return {
      id: uid("priority"),
      panelId: item.panelId,
      level: recommendation.level,
      title: recommendation.title,
      text: recommendation.text,
      actionId: recommendation.actionId,
      actionLabel: recommendation.actionLabel,
      score: recommendation.score,
    };
  });
  return priorities.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function buildActionQueue(limit = 6): ActionQueueItem[] {
  return buildTopPriorities(limit + 2)
    .filter((item) => item.actionId)
    .slice(0, limit)
    .map((item, idx) => ({
      id: `queue_${idx}_${item.panelId}`,
      panelId: item.panelId,
      level: item.level,
      title: item.title,
      body: item.text,
      actionId: item.actionId,
      actionLabel: item.actionLabel,
      score: item.score,
    }));
}

function chipsForPanel(panelId: string, limit = 6): MissionControlChip[] {
  const meta = getPanelMeta(panelId);
  const ids = (meta.quickActionIds || []).filter(Boolean);
  const chips: MissionControlChip[] = [];

  // Priority: real quick actions first.
  for (const id of ids) {
    const action = QUICK_ACTIONS.find((a) => a.id === id);
    if (!action) continue;
    chips.push({ label: action.label, actionId: action.id });
    if (chips.length >= limit) break;
  }

  // Always allow opening the panel.
  if (chips.length < limit) {
    const openAction = QUICK_ACTIONS.find((a) => a.panelId && normalizePanelId(a.panelId) === normalizePanelId(panelId) && a.id.startsWith("panel:"));
    if (openAction) chips.push({ label: openAction.label, actionId: openAction.id });
  }

  return chips.slice(0, limit);
}

export function buildMissionControlPanelCards(panelIds?: string[], limit = 9): MissionControlPanelCard[] {
  const targets = (panelIds || [
    "Trading",
    "FamilyBudget",
    "Grow",
    "News",
    "FamilyHealth",
    "GroceryMeals",
    "HappyHealthy",
    "Cannabis",
    "Security",
    "Money",
    "OptionsSaaS",
  ]).map((id) => normalizePanelId(id));

  const cards = targets.map((panelId) => {
    const rec = recommendActionForPanel(panelId);
    return {
      id: uid("mc_card"),
      panelId,
      level: rec.level,
      score: rec.score,
      priorityTitle: rec.title,
      priorityText: rec.text,
      nextActionId: rec.actionId,
      nextActionLabel: rec.actionLabel,
      chips: chipsForPanel(panelId, 5),
    };
  });

  // Sort: hottest first.
  return cards.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function buildOperatorFeed(limit = 10): OperatorFeedItem[] {
  const actions = getActionHistory().slice(0, 4).map((item) => ({
    id: `feed_action_${item.id}`,
    ts: item.ts,
    panelId: item.panelId,
    source: "action" as const,
    level: item.undoneAt ? "muted" as const : item.status === "success" ? "good" as const : item.status === "warn" ? "warn" as const : item.status === "error" ? "error" as const : "muted" as const,
    title: item.undoneAt ? `${item.title} (undone)` : item.title,
    body: item.body,
  }));
  const memories = getBrainMemories().slice(0, 4).map((item) => ({
    id: `feed_memory_${item.id}`,
    ts: item.ts,
    panelId: item.panelId,
    source: "memory" as const,
    level: item.kind === "error" ? "error" as const : item.kind === "automation" ? "warn" as const : "muted" as const,
    title: item.title,
    body: item.body,
  }));
  const activity = getActivity().slice(0, 4).map((item) => ({
    id: `feed_activity_${item.id}`,
    ts: item.ts,
    panelId: item.panelId || "Brain",
    source: "activity" as const,
    level: item.kind === "system" ? "warn" as const : "muted" as const,
    title: item.title,
    body: item.body || "",
  }));
  const notifs = getNotifs().slice(0, 4).map((item) => ({
    id: `feed_notif_${item.id}`,
    ts: Number(item.ts || Date.now()),
    panelId: normalizePanelId((item.tags || []).find(Boolean) || "Brain"),
    source: "notification" as const,
    level: item.level === "error" ? "error" as const : item.level === "warn" ? "warn" as const : item.level === "success" ? "good" as const : "muted" as const,
    title: item.title,
    body: item.body || "",
  }));
  const missions = buildTopPriorities(4).map((item, idx) => ({
    id: `feed_mission_${idx}_${item.panelId}`,
    ts: Date.now() - idx,
    panelId: item.panelId,
    source: "mission" as const,
    level: item.level === "error" ? "error" as const : item.level === "warn" ? "warn" as const : "good" as const,
    title: item.title,
    body: item.text,
  }));
  return [...actions, ...memories, ...activity, ...notifs, ...missions]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);
}

function greetingByHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function buildMorningDigest() {
  const now = new Date();
  const top = buildTopPriorities(3);
  const queue = buildActionQueue(3);
  const health = buildPanelHealth(["Trading", "FamilyBudget", "Grow", "Security", "Money", "OptionsSaaS"]);
  const operator = buildOperatorFeed(4);
  const avgHealth = health.length ? Math.round(health.reduce((sum, item) => sum + item.score, 0) / health.length) : 0;
  const lines = [
    `**${greetingByHour(now.getHours())} — Mission Control**`,
    `Updated ${now.toLocaleString()}`,
    "",
    `**OS health**`,
    `- Average panel health: ${avgHealth}/100`,
    `- Highest priority: ${top[0] ? `${getPanelMeta(top[0].panelId).title} — ${top[0].title}` : "No urgent priorities right now."}`,
    `- Action queue depth: ${queue.length}`,
    "",
  ];
  if (top.length) {
    lines.push("**Top priorities**");
    top.forEach((item) => lines.push(`- ${getPanelMeta(item.panelId).title}: ${item.text}`));
    lines.push("");
  }
  if (queue.length) {
    lines.push("**Next actions**");
    queue.forEach((item, idx) => lines.push(`- ${idx + 1}. ${item.title}${item.actionLabel ? ` → ${item.actionLabel}` : ""}`));
    lines.push("");
  }
  if (operator.length) {
    lines.push("**AI operator feed**");
    operator.slice(0, 3).forEach((item) => lines.push(`- ${getPanelMeta(item.panelId).title}: ${item.title}`));
  }
  return lines.join("\n").trim();
}

export function buildDailyDigest() {
  const contexts = [readPanelContext("OddBrain"), readPanelContext("Trading"), readPanelContext("FamilyBudget"), readPanelContext("Grow"), readPanelContext("News"), readPanelContext("FamilyHealth"), readPanelContext("GroceryMeals")];
  const priorities = buildTopPriorities(5);
  const lines = [buildMorningDigest(), "", "**Deep panel scan**", ""];
  for (const ctx of contexts) {
    lines.push(`**${ctx.meta.icon} ${ctx.meta.title}**`, `- ${ctx.summary}`);
    for (const d of ctx.details.slice(1, 3)) lines.push(`- ${d}`);
    lines.push("");
  }
  if (priorities.length) {
    lines.push("**Priority stack**");
    for (const m of priorities) lines.push(`- ${getPanelMeta(m.panelId).title}: ${m.text}`);
  }
  return lines.join("\n").trim();
}

export function buildMissions() {
  const missions: Array<{ id: string; panelId: string; level: "good" | "warn" | "error"; text: string }> = [];
  const budget = safeJson("oddengine:familyBudget:v2");
  const trading = safeJson("oddengine:trading:sniper:v4");
  const chain = safeJson("odd.trading.chainSnapshot");
  const growProfile = safeJson("oddengine:grow:profile");
  const growReadings = safeJson("oddengine:grow:readings") || [];
  const mining = safeJson("oddengine:mining:v1");
  const security = safeJson("oddengine:security:v1") || { ipLock: true };
  const news = safeJson("oddengine:news:v1");
  const familyHealth = safeJson("oddengine:familyHealth:v1");
  const grocery = safeJson("oddengine:groceryMeals:v1");
  const saas = safeJson("oddengine:optionssaas:v1");
  const plugins = safeJson("oddengine:plugins:user:v1") || [];

  if (!budget?.accounts?.length) missions.push({ id: uid("mission"), panelId: "FamilyBudget", level: "warn", text: "Family Budget needs accounts or balances before the payoff planner becomes useful." });
  if (budget?.accounts?.length && !budget?.transactions?.length) missions.push({ id: uid("mission"), panelId: "FamilyBudget", level: "warn", text: "Budget has accounts but no transactions yet — import CSV or add quick entries." });
  if (!trading?.symbol) missions.push({ id: uid("mission"), panelId: "Trading", level: "warn", text: "Trading panel needs a live symbol/setup before the coach can rank opportunities." });
  if (trading?.symbol && !chain?.contracts?.length) missions.push({ id: uid("mission"), panelId: "Trading", level: "warn", text: `Load a fresh option chain for ${trading.symbol} so the panel assistant has contract context.` });
  if (!growProfile?.name) missions.push({ id: uid("mission"), panelId: "Grow", level: "warn", text: "Grow panel needs a room profile and a few readings to make the coach useful." });
  if (growProfile?.name && !growReadings.length) missions.push({ id: uid("mission"), panelId: "Grow", level: "warn", text: "Grow profile exists but no readings are logged yet — add a baseline reading." });
  if (!mining?.miners?.length) missions.push({ id: uid("mission"), panelId: "Mining", level: "warn", text: "Mining radar has no miners yet — seed hardware and pools so alerts matter." });
  if (security && !security.ipLock) missions.push({ id: uid("mission"), panelId: "Security", level: "error", text: "Security is in LAN-friendly mode. Re-enable IP Lock unless you really need network access." });
  if (!saas || (typeof saas === "string" && !saas.trim()) || (typeof saas === "object" && !saas.productName)) missions.push({ id: uid("mission"), panelId: "OptionsSaaS", level: "good", text: "Options SaaS is ready for a real MVP brief. Fill the buyer, promise, and pricing first." });
  if (!plugins.length) missions.push({ id: uid("mission"), panelId: "Plugins", level: "good", text: "No user plugins are installed yet. Add one simple plugin template after the core AI layer is stable." });
  if (!news?.lastUpdated) missions.push({ id: uid("mission"), panelId: "News", level: "good", text: "Refresh News so weather, local headlines, and economics are ready for Mission Control." });
  if (!(familyHealth?.members || []).length) missions.push({ id: uid("mission"), panelId: "FamilyHealth", level: "warn", text: "Family Health needs at least one family member tab before care briefs and research are useful." });
  if (!(grocery?.groceryList || []).length) missions.push({ id: uid("mission"), panelId: "GroceryMeals", level: "good", text: "Grocery Meals is waiting for a generated shopping list and fresh coupon lane." });

  return missions.slice(0, 8);
}

export function buildInboxSummary() {
  const notifs = getNotifs().slice(0, 6);
  const activity = getActivity().slice(0, 6);
  return {
    notifs,
    activity,
    missions: buildTopPriorities(6),
    notes: getBrainNotes().slice(0, 6),
    memories: getBrainMemories().slice(0, 6),
    actions: getActionHistory().slice(0, 8),
    queue: buildActionQueue(5),
    panelCards: buildMissionControlPanelCards(undefined, 9),
    panelHealth: buildPanelHealth(["Trading", "FamilyBudget", "Grow", "News", "FamilyHealth", "GroceryMeals", "Security", "Money", "OptionsSaaS"]),
    operatorFeed: buildOperatorFeed(8),
  };
}




