import { getGoals, getPanelMeta, normalizePanelId } from "./brain";
import { buildRecoverySnapshot } from "./recoveryPlanner";
import { buildRecoveryAwareIncomeSniperBoard, getIncomeSniperOutcomeRecords } from "./incomeSniper";
import { loadJSON, saveJSON } from "./storage";

export type HomieInteractionKind = "draft" | "voice" | "action";

export type HomieInteraction = {
  id: string;
  ts: number;
  kind: HomieInteractionKind;
  panelId: string;
  text: string;
};

export type HomieWorkingLane = {
  laneKey: string;
  title: string;
  category: string;
  panelId: string;
  actualUsd: number;
  wins: number;
  lastTs: number;
} | null;

export type HomiePinnedFact = {
  id: string;
  text: string;
  panelId: string;
  ts: number;
};

export type HomieRelationshipMilestone = {
  id: string;
  text: string;
  panelId: string;
  ts: number;
};

export type HomiePanelCompanionMemory = {
  panelId: string;
  panelTitle: string;
  mood: string;
  context: string;
  lastNeed: string;
  lastSummary: string;
  updatedAt: number;
};

export type HomieRoutineCheckIn = {
  id: string;
  ts: number;
  panelId: string;
  panelTitle: string;
  need: string;
  summary: string;
  arc: string;
  routine: string;
};

export type HomieCompanionLaneMemory = {
  pinnedFacts: HomiePinnedFact[];
  milestones: HomieRelationshipMilestone[];
  panelMemory: Record<string, HomiePanelCompanionMemory>;
  routineCheckIns: HomieRoutineCheckIn[];
  updatedAt: number;
};

export type HomieRelationshipMemory = {
  goals: string[];
  mainGoal: string;
  energyMode: string;
  favoritePanelId: string;
  favoritePanelLabel: string;
  workingLane: HomieWorkingLane;
  recentPrompts: string[];
  relationshipHeadline: string;
  relationshipBrief: string;
  patternLine: string;
  moneyLine: string;
  conversationArcLine: string;
  sharedRoutineLine: string;
  latelyLine: string;
  gentleCheckInCue: string;
  pinnedFacts: HomiePinnedFact[];
  milestones: HomieRelationshipMilestone[];
  panelMoodSummary: string;
  panelContextSummary: string;
  routineCheckIns: HomieRoutineCheckIn[];
};

const HOMIE_INTERACTIONS_KEY = "oddengine:homie:interactions:v1";
const HOMIE_COMPANION_LANE_KEY = "oddengine:homie:companion:lane:v1";
const MAX_INTERACTIONS = 80;
const MAX_PINNED_FACTS = 8;
const MAX_MILESTONES = 8;
const MAX_PANEL_MEMORY = 12;
const MAX_ROUTINE_CHECKINS = 12;

function uid(prefix = "hmem") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function round2(n: number) {
  return Number((Number(n) || 0).toFixed(2));
}

function compact(text: string, max = 180) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length <= max ? clean : `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function stripMemoryLabel(text: string, kind: "arc" | "routine" | "lately" | "generic" = "generic") {
  let clean = compact(text || "", 220);
  if (!clean) return "";

  const keepTailAfterLastLabel = (input: string, pattern: RegExp) => {
    const matches = Array.from(input.matchAll(pattern));
    if (matches.length > 1) {
      const last = matches[matches.length - 1];
      const idx = Number(last.index || 0) + String(last[0] || "").length;
      return input.slice(idx);
    }
    return input;
  };

  if (kind === "arc" || kind === "generic") {
    clean = keepTailAfterLastLabel(clean, /(?:conversation\s*arc|arc)\s*:\s*/ig);
    clean = clean.replace(/(?:conversation\s*arc|arc)\s*:\s*/ig, "");
  }
  if (kind === "routine" || kind === "generic") {
    clean = keepTailAfterLastLabel(clean, /(?:shared\s*routine|routine)\s*:\s*/ig);
    clean = clean.replace(/(?:shared\s*routine|routine)\s*:\s*/ig, "");
  }
  if (kind === "lately" || kind === "generic") {
    clean = keepTailAfterLastLabel(clean, /lately\s*:\s*/ig);
    clean = clean.replace(/lately\s*:\s*/ig, "");
  }

  clean = clean
    .replace(/(?:conversation\s*arc|shared\s*routine|routine|arc|lately)\s*:\s*/ig, "")
    .replace(/(lately\s+){2,}/ig, "lately ")
    .replace(/\s*[•|]+\s*/g, " • ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return compact(clean, 220);
}

function dedupeFacts(rows: HomiePinnedFact[]) {
  const seen = new Set<string>();
  const out: HomiePinnedFact[] = [];
  for (const row of rows) {
    const text = compact(row?.text || "", 160);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: String(row?.id || uid("fact")),
      text,
      panelId: normalizePanelId(row?.panelId || "Home"),
      ts: Number(row?.ts || Date.now()) || Date.now(),
    });
    if (out.length >= MAX_PINNED_FACTS) break;
  }
  return out;
}

function dedupeMilestones(rows: HomieRelationshipMilestone[]) {
  const seen = new Set<string>();
  const out: HomieRelationshipMilestone[] = [];
  for (const row of rows) {
    const text = compact(row?.text || "", 180);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: String(row?.id || uid("mile")),
      text,
      panelId: normalizePanelId(row?.panelId || "Home"),
      ts: Number(row?.ts || Date.now()) || Date.now(),
    });
    if (out.length >= MAX_MILESTONES) break;
  }
  return out;
}


function timeBucketFor(ts: number) {
  const date = new Date(Number(ts || Date.now()));
  const hour = Number.isFinite(date.getHours()) ? date.getHours() : 12;
  if (hour < 5) return "late-night reset";
  if (hour < 12) return "morning reset";
  if (hour < 17) return "midday regroup";
  if (hour < 22) return "evening wind-down";
  return "night check-in";
}

function normalizeRoutineCheckInRecord(value?: Partial<HomieRoutineCheckIn> | null): HomieRoutineCheckIn {
  const panelId = normalizePanelId(value?.panelId || "Home");
  const panelMeta = getPanelMeta(panelId);
  const ts = Number(value?.ts || Date.now()) || Date.now();
  const need = compact(stripMemoryLabel(String(value?.need || ""), "generic"), 160);
  const summary = compact(stripMemoryLabel(String(value?.summary || need || panelMeta.title), "generic"), 220);
  const arc = compact(stripMemoryLabel(String(value?.arc || need || summary || `Keep moving inside ${panelMeta.title}.`), "arc"), 180);
  const routine = compact(stripMemoryLabel(String(value?.routine || `${timeBucketFor(ts)} • ${panelMeta.title}`), "routine"), 120);
  return {
    id: String(value?.id || uid("checkin")),
    ts,
    panelId,
    panelTitle: String(value?.panelTitle || panelMeta.title || panelId),
    need,
    summary,
    arc,
    routine,
  };
}

function dedupeRoutineCheckIns(rows: HomieRoutineCheckIn[]) {
  const seen = new Set<string>();
  const out: HomieRoutineCheckIn[] = [];
  for (const row of rows) {
    const normalized = normalizeRoutineCheckInRecord(row);
    const key = `${normalized.panelId}|${normalized.arc.toLowerCase()}|${normalized.routine.toLowerCase()}`;
    if (!normalized.summary || seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
    if (out.length >= MAX_ROUTINE_CHECKINS) break;
  }
  return out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

function panelMoodDefault(panelId: string) {
  const normalized = normalizePanelId(panelId || "Home").toLowerCase();
  if (normalized === "trading") return "calm sniper";
  if (normalized === "money" || normalized === "phoenixincomeforge") return "money hunter";
  if (normalized === "books" || normalized === "builder" || normalized === "studio") return "creator heat";
  if (normalized === "familyhealth" || normalized === "happyhealthy") return "recovery guide";
  if (normalized === "grow" || normalized === "cannabis") return "watchful operator";
  if (normalized === "brain" || normalized === "homie") return "shell operator";
  return "steady companion";
}

function normalizePanelMemoryRecord(panelId: string, value?: Partial<HomiePanelCompanionMemory> | null): HomiePanelCompanionMemory {
  const id = normalizePanelId(panelId || value?.panelId || "Home");
  const meta = getPanelMeta(id);
  return {
    panelId: id,
    panelTitle: String(value?.panelTitle || meta.title || id),
    mood: compact(String(value?.mood || panelMoodDefault(id)), 80),
    context: compact(String(value?.context || ""), 220),
    lastNeed: compact(String(value?.lastNeed || ""), 160),
    lastSummary: compact(String(value?.lastSummary || ""), 220),
    updatedAt: Number(value?.updatedAt || Date.now()) || Date.now(),
  };
}

function normalizeLaneMemory(raw: any): HomieCompanionLaneMemory {
  const sourcePanelMemory = raw?.panelMemory && typeof raw.panelMemory === "object" ? raw.panelMemory : {};
  const panelEntries = Object.entries(sourcePanelMemory)
    .map(([key, value]) => normalizePanelMemoryRecord(key, value as any))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, MAX_PANEL_MEMORY);
  return {
    pinnedFacts: dedupeFacts(Array.isArray(raw?.pinnedFacts) ? raw.pinnedFacts : []),
    milestones: dedupeMilestones(Array.isArray(raw?.milestones) ? raw.milestones : []),
    panelMemory: Object.fromEntries(panelEntries.map((row) => [row.panelId, row])),
    routineCheckIns: dedupeRoutineCheckIns(Array.isArray(raw?.routineCheckIns) ? raw.routineCheckIns : []),
    updatedAt: Number(raw?.updatedAt || Date.now()) || Date.now(),
  };
}

export function getHomieInteractions() {
  const raw = loadJSON<HomieInteraction[]>(HOMIE_INTERACTIONS_KEY, []);
  return Array.isArray(raw) ? raw : [];
}

export function noteHomieInteraction(kind: HomieInteractionKind, text: string, panelId?: string) {
  const clean = String(text || "").trim();
  if (!clean) return null;
  const item: HomieInteraction = {
    id: uid(),
    ts: Date.now(),
    kind,
    panelId: normalizePanelId(panelId || "Home"),
    text: clean,
  };
  const next = [item, ...getHomieInteractions()].slice(0, MAX_INTERACTIONS);
  saveJSON(HOMIE_INTERACTIONS_KEY, next);
  return item;
}

export function loadHomieCompanionLaneMemory(): HomieCompanionLaneMemory {
  return normalizeLaneMemory(loadJSON<any>(HOMIE_COMPANION_LANE_KEY, null as any) || {});
}

export function saveHomieCompanionLaneMemory(next: HomieCompanionLaneMemory) {
  const normalized = normalizeLaneMemory(next || {});
  saveJSON(HOMIE_COMPANION_LANE_KEY, normalized);
  return normalized;
}

export function pinHomieFact(text: string, panelId?: string) {
  const clean = compact(text, 160);
  if (!clean) return loadHomieCompanionLaneMemory();
  const current = loadHomieCompanionLaneMemory();
  return saveHomieCompanionLaneMemory({
    ...current,
    pinnedFacts: dedupeFacts([{ id: uid("fact"), text: clean, panelId: normalizePanelId(panelId || "Home"), ts: Date.now() }, ...current.pinnedFacts]),
    updatedAt: Date.now(),
  });
}

export function addHomieMilestone(text: string, panelId?: string) {
  const clean = compact(text, 180);
  if (!clean) return loadHomieCompanionLaneMemory();
  const current = loadHomieCompanionLaneMemory();
  return saveHomieCompanionLaneMemory({
    ...current,
    milestones: dedupeMilestones([{ id: uid("mile"), text: clean, panelId: normalizePanelId(panelId || "Home"), ts: Date.now() }, ...current.milestones]),
    updatedAt: Date.now(),
  });
}

export function rememberPanelCompanionState(panelId: string, patch: Partial<HomiePanelCompanionMemory>) {
  const current = loadHomieCompanionLaneMemory();
  const id = normalizePanelId(panelId || patch.panelId || "Home");
  const merged = normalizePanelMemoryRecord(id, {
    ...(current.panelMemory[id] || {}),
    ...patch,
    panelId: id,
    updatedAt: Date.now(),
  });
  return saveHomieCompanionLaneMemory({
    ...current,
    panelMemory: { ...current.panelMemory, [id]: merged },
    updatedAt: Date.now(),
  });
}

export function getFavoritePanelId(activePanelId: string) {
  const counts = new Map<string, number>();
  for (const row of getHomieInteractions()) {
    const id = normalizePanelId(row.panelId || "Home");
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  counts.set(normalizePanelId(activePanelId || "Home"), (counts.get(normalizePanelId(activePanelId || "Home")) || 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || normalizePanelId(activePanelId || "Home");
}

function getWorkingLane() {
  const rows = getIncomeSniperOutcomeRecords();
  if (!rows.length) return null;
  const grouped = new Map<string, HomieWorkingLane>();
  for (const row of rows) {
    const current = grouped.get(row.laneKey) || {
      laneKey: row.laneKey,
      title: row.title,
      category: row.category,
      panelId: row.panelId,
      actualUsd: 0,
      wins: 0,
      lastTs: 0,
    };
    current.actualUsd = round2(current.actualUsd + Number(row.realizedUsd || 0));
    current.wins += row.outcome === "win" ? 1 : 0;
    current.lastTs = Math.max(current.lastTs, Number(row.ts || 0));
    grouped.set(row.laneKey, current);
  }
  return Array.from(grouped.values()).sort((a, b) => (b.actualUsd * 100 + b.wins * 10 + b.lastTs / 1e10) - (a.actualUsd * 100 + a.wins * 10 + a.lastTs / 1e10))[0] || null;
}

export function buildPanelCompanionMemory(activePanelId: string) {
  const lane = loadHomieCompanionLaneMemory();
  const id = normalizePanelId(activePanelId || "Home");
  const current = lane.panelMemory[id] || normalizePanelMemoryRecord(id, null);
  const favorite = lane.panelMemory[getFavoritePanelId(id)] || null;
  const recentPanels = Object.values(lane.panelMemory)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 3);
  return {
    current,
    favorite,
    recentPanels,
    pinnedFacts: lane.pinnedFacts,
    milestones: lane.milestones,
    routineCheckIns: lane.routineCheckIns,
  } as any;
}

function buildConversationArcLine(checkIns: HomieRoutineCheckIn[], fallbackNeed: string) {
  const cleanFallbackNeed = stripMemoryLabel(String(fallbackNeed || ""), "arc").toLowerCase();
  if (!checkIns.length) return cleanFallbackNeed ? `Conversation arc: still circling around ${cleanFallbackNeed}.` : "Conversation arc: still warming up — let Homie learn what you and it are really working through lately.";
  const topics = Array.from(new Set(checkIns.map((row) => stripMemoryLabel(row.arc || "", "arc")).filter(Boolean))).slice(0, 2);
  if (!topics.length) return "Conversation arc: keep the thread gentle, practical, and continuous.";
  if (topics.length === 1) return `Conversation arc: lately you and Homie keep returning to ${topics[0].toLowerCase()}.`;
  return `Conversation arc: lately the thread keeps moving between ${topics[0].toLowerCase()} and ${topics[1].toLowerCase()}.`;
}

function buildSharedRoutineLine(checkIns: HomieRoutineCheckIn[], favoritePanelLabel: string) {
  if (!checkIns.length) return `Shared routine: gentle check-ins around ${favoritePanelLabel} are still forming.`;
  const routine = stripMemoryLabel(checkIns[0]?.routine || "steady check-ins", "routine") || "steady check-ins";
  const panelLabel = checkIns[0]?.panelTitle || favoritePanelLabel;
  return `Shared routine: ${routine} has been a natural time to reconnect around ${panelLabel}.`;
}

function buildLatelyLine(checkIns: HomieRoutineCheckIn[], recentPrompts: string[]) {
  const bits = [
    ...checkIns.slice(0, 2).map((row) => row.summary).filter(Boolean),
    ...recentPrompts.slice(0, 1).filter(Boolean),
  ].slice(0, 3);
  if (!bits.length) return "Lately: still gathering a real thread instead of pretending there is one.";
  return `Lately: ${bits.join(" • ")}`;
}

function buildGentleCheckInCue(checkIns: HomieRoutineCheckIn[], currentNeed: string) {
  if (checkIns.length) {
    const latest = checkIns[0];
    if (latest?.need) return `Check in softly on ${latest.need.toLowerCase()} before jumping into advice.`;
    if (latest?.routine) return `Check in softly around the ${latest.routine.toLowerCase()} rhythm before pushing the next step.`;
  }
  if (currentNeed) return `Check in softly on ${currentNeed.toLowerCase()} before offering the next move.`;
  return "Check in softly first, then offer one grounded next move.";
}

export function logHomieRoutineCheckIn(panelId: string, patch: { need?: string; summary?: string; arc?: string; routine?: string; panelTitle?: string; ts?: number }) {
  const current = loadHomieCompanionLaneMemory();
  const record = normalizeRoutineCheckInRecord({
    panelId,
    panelTitle: patch.panelTitle,
    need: patch.need,
    summary: patch.summary,
    arc: patch.arc,
    routine: patch.routine,
    ts: patch.ts,
  });
  return saveHomieCompanionLaneMemory({
    ...current,
    routineCheckIns: dedupeRoutineCheckIns([record, ...(current.routineCheckIns || [])]),
    updatedAt: Date.now(),
  });
}

export function buildHomieRelationshipMemory(activePanelId: string): HomieRelationshipMemory {
  const goals = getGoals().split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const recovery = buildRecoverySnapshot();
  const board = buildRecoveryAwareIncomeSniperBoard(6);
  const workingLane = getWorkingLane();
  const recentPrompts = getHomieInteractions().slice(0, 4).map((row) => row.text);
  const favoritePanelId = getFavoritePanelId(activePanelId);
  const favoritePanelMeta = getPanelMeta(favoritePanelId);
  const laneMemory = loadHomieCompanionLaneMemory();
  const panelMemory = buildPanelCompanionMemory(activePanelId) as any;
  const routineCheckIns = laneMemory.routineCheckIns || [];
  const mainGoal = goals[0] || "Keep the OS pointed at the safest legit path to home income.";
  const energyMode = `${recovery.mode} • ${recovery.capacity} capacity • ${recovery.timeAvailableMin}m`;
  const bestMove = board.todayBestMove;
  const moneyLine = bestMove
    ? `${bestMove.title} looks strongest today because ${bestMove.fitReason.toLowerCase()}.`
    : "No dominant money lane yet — log more outcomes and refresh Income Sniper.";
  const relationshipHeadline = workingLane
    ? `Homie remembers ${workingLane.title} is one of the lanes that has actually paid you.`
    : goals.length
      ? `Homie is keeping your current push warm: ${mainGoal}`
      : "Homie is ready to learn your goals, your rough-day pattern, and what actually pays.";
  const relationshipBrief = [
    `Main goal: ${mainGoal}`,
    `Favorite panel lately: ${favoritePanelMeta.title}`,
    workingLane ? `Lane working best so far: ${workingLane.category} • ${workingLane.title}${workingLane.actualUsd ? ` • $${Math.round(Math.abs(workingLane.actualUsd)).toLocaleString()} logged` : ""}` : "No logged winning lane yet, so Homie stays curious and light on pressure.",
  ].join(" • ");

  let patternLine = `Recovery read: ${energyMode}.`;
  if (recovery.capacity === "low") {
    patternLine += " Homie should stay close, calm the noise, and favor tiny-step, from-home, low-friction moves before heavier builds or risky trades.";
  } else if (recovery.capacity === "high") {
    patternLine += " Homie can push harder on shipping, building, and higher-focus income lanes today, but still keep the plan warm and human.";
  } else {
    patternLine += " Homie should keep the plan practical, grounded, and far away from overload.";
  }
  if (recentPrompts.length) patternLine += ` Recent asks: ${recentPrompts.slice(0, 2).join(" • ")}.`;

  const panelMoodSummary = panelMemory.current?.mood
    ? `${panelMemory.current.panelTitle} mood: ${panelMemory.current.mood}`
    : `Homie treats ${getPanelMeta(activePanelId).title} like a ${panelMoodDefault(activePanelId)} lane.`;
  const panelContextSummary = [
    panelMemory.current?.context ? `${panelMemory.current.panelTitle}: ${panelMemory.current.context}` : "",
    panelMemory.current?.lastNeed ? `Need: ${panelMemory.current.lastNeed}` : "",
    panelMemory.favorite?.panelId && panelMemory.favorite.panelId !== panelMemory.current.panelId ? `Favorite lane mood: ${panelMemory.favorite.panelTitle} • ${panelMemory.favorite.mood}` : "",
  ].filter(Boolean).join(" • ");

  const conversationArcLine = buildConversationArcLine(routineCheckIns, panelMemory.current?.lastNeed || mainGoal);
  const sharedRoutineLine = buildSharedRoutineLine(routineCheckIns, favoritePanelMeta.title);
  const latelyLine = buildLatelyLine(routineCheckIns, recentPrompts);
  const gentleCheckInCue = buildGentleCheckInCue(routineCheckIns, panelMemory.current?.lastNeed || mainGoal);

  return {
    goals,
    mainGoal,
    energyMode,
    favoritePanelId,
    favoritePanelLabel: `${favoritePanelMeta.icon} ${favoritePanelMeta.title}`,
    workingLane,
    recentPrompts,
    relationshipHeadline,
    relationshipBrief,
    patternLine,
    moneyLine,
    conversationArcLine,
    sharedRoutineLine,
    latelyLine,
    gentleCheckInCue,
    pinnedFacts: laneMemory.pinnedFacts,
    milestones: laneMemory.milestones,
    panelMoodSummary,
    panelContextSummary,
    routineCheckIns,
  };
}
