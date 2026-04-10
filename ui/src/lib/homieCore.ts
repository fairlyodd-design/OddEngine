import { buildMissions, getBrainNotes, getGoals, getPanelMeta, readPanelContext } from "./brain";
import { buildRecoveryAwareIncomeSniperBoard, type IncomeSniperMove } from "./incomeSniper";
import { buildMoneyAutopilotQueue, type MoneyAutopilotQueueItem } from "./moneyAutopilot";
import { buildRecoverySnapshot, type RecoverySnapshot } from "./recoveryPlanner";
import { loadPrefs } from "./prefs";
import { loadJSON, saveJSON } from "./storage";
import { buildHomieRelationshipMemory, noteHomieInteraction } from "./homieMemory";

export type HomieDraft = {
  text: string;
  createdAt: number;
  source?: string;
  panelId?: string;
};

export type HomieCoreAction = {
  id: string;
  label: string;
  kind: "navigate" | "homie-draft" | "quick-action";
  panelId?: string;
  prompt?: string;
  actionId?: string;
};

export type HomieCoreSnapshot = {
  generatedAt: number;
  panelId: string;
  panelTitle: string;
  panelIcon: string;
  panelSummary: string;
  shellRole: string;
  operatorHeadline: string;
  briefing: string;
  energyHeadline: string;
  missionCount: number;
  noteCount: number;
  goalCount: number;
  recovery: RecoverySnapshot;
  todayBestMove: IncomeSniperMove | null;
  nextMoneyMove: MoneyAutopilotQueueItem | null;
  suggestedPrompts: string[];
  quickActions: HomieCoreAction[];
  moneyFocusLabel: string;
  moneyFocusBrief: string;
  conversationReadyLabel: string;
  companionMode: "grounding" | "steady" | "phoenix";
  companionHeadline: string;
  companionBrief: string;
  checkInPrompts: string[];
  memoryHeadline: string;
  memoryBrief: string;
  memoryPattern: string;
};

export const HOMIE_DRAFT_KEY = "oddengine:homie:draft:v1";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function summarizeLane(move?: { title?: string; category?: string; amountLabel?: string | null; panelId?: string } | null) {
  if (!move) return "No ranked lane yet";
  return [move.title, move.amountLabel].filter(Boolean).join(" • ");
}

function describeRecovery(snapshot: RecoverySnapshot) {
  const energyLabel = snapshot.capacity === "high" ? "full send" : snapshot.capacity === "medium" ? "steady" : "protect energy";
  return `${snapshot.mode} mode • ${energyLabel} • ${snapshot.timeAvailableMin}m window`;
}

function promptsForPanel(panelId: string, bestMove: IncomeSniperMove | null) {
  const base = [
    "Rank my best legit money move for today.",
    "Turn today's best move into 3 tiny steps.",
    "Give me the lowest-energy way to make or save money today.",
  ];
  const normalized = String(panelId || "").toLowerCase();
  if (normalized === "trading") {
    return [
      "Am I actually clear enough to trade right now, or should I skip?",
      "Summarize the safest next setup in plain English.",
      "Build a no-chase plan for today's best setup.",
    ];
  }
  if (normalized === "money") {
    return [
      `Turn ${bestMove?.title || "today's best move"} into a 30-minute cash sprint.`,
      "What should I monetize first with zero upfront cost?",
      "Give me the fastest legit $ path from home today.",
    ];
  }
  if (normalized === "familybudget") {
    return [
      "Show me the easiest money leak to kill today.",
      "What can I save in 15 minutes without spending money first?",
      "Turn today's savings move into a quick checklist.",
    ];
  }
  if (normalized === "cryptogames") {
    return [
      "Which game or filler lane is actually worth my energy today?",
      "Give me the best short sat-earning move right now.",
      "Should I do games, surveys, or a product task today?",
    ];
  }
  return base;
}

export function seedHomieDraft(text: string, opts?: { source?: string; panelId?: string }) {
  const payload: HomieDraft = {
    text: String(text || "").trim(),
    createdAt: Date.now(),
    source: opts?.source,
    panelId: opts?.panelId,
  };
  if (!payload.text) return null;
  noteHomieInteraction("draft", payload.text, payload.panelId || opts?.panelId);
  saveJSON(HOMIE_DRAFT_KEY, payload);
  try {
    window.dispatchEvent(new CustomEvent("oddengine:homie-draft", { detail: payload }));
  } catch {
    // ignore
  }
  return payload;
}

export function getHomieDraft() {
  return loadJSON<HomieDraft | null>(HOMIE_DRAFT_KEY, null);
}

export function consumeHomieDraft() {
  const draft = getHomieDraft();
  try {
    localStorage.removeItem(HOMIE_DRAFT_KEY);
  } catch {
    // ignore
  }
  return draft;
}

export function buildHomieCoreSnapshot(activePanelId: string): HomieCoreSnapshot {
  const panelMeta = getPanelMeta(activePanelId);
  const panelCtx = readPanelContext(activePanelId);
  const recovery = buildRecoverySnapshot();
  const incomeBoard = buildRecoveryAwareIncomeSniperBoard(6);
  const moneyQueue = buildMoneyAutopilotQueue(8);
  const prefs = loadPrefs();
  const tone = prefs.ai.tone;
  const missionCount = buildMissions().length;
  const noteCount = getBrainNotes().length;
  const goalCount = getGoals().split(/\n+/).filter(Boolean).length;
  const todayBestMove = incomeBoard.todayBestMove;
  const nextMoneyMove = moneyQueue.nextMove;
  const memory = buildHomieRelationshipMemory(activePanelId);
  const laneLine = summarizeLane(todayBestMove);
  const autopilotLine = summarizeLane(nextMoneyMove);
  const recoveryLine = describeRecovery(recovery);
  const shellRole = tone === "operator"
    ? "Operator brain"
    : tone === "builder"
      ? "Builder companion"
      : "Coach companion";

  let operatorHeadline = `${panelMeta.icon} ${panelMeta.title} is active.`;
  let briefing = `${panelCtx.summary} Best home-income lane right now: ${laneLine}.`;

  const normalized = String(activePanelId || "").toLowerCase();
  if (normalized === "trading") {
    operatorHeadline = recovery.capacity === "low"
      ? "Homie says protect energy before you protect ego."
      : "Homie says only the cleanest setup gets your attention.";
    briefing = recovery.protectCapital
      ? `Trading is live, but recovery says protect capital. Better lane: ${laneLine}. Autopilot next: ${autopilotLine}.`
      : `Trading is live. Keep it thesis-first, size small, and only touch the cleanest setup. Income fallback: ${laneLine}.`;
  } else if (normalized === "money") {
    operatorHeadline = todayBestMove
      ? `Homie found a likely best move: ${todayBestMove.title}`
      : "Homie is waiting for stronger money signals.";
    briefing = `Recovery profile: ${recoveryLine}. Today’s best legit move: ${laneLine}. Money Autopilot next: ${autopilotLine}.`;
  } else if (normalized === "familybudget") {
    operatorHeadline = "Homie is hunting leaks and easy saves.";
    briefing = `Budget mode is strongest when energy is low. ${laneLine}. Autopilot next: ${autopilotLine}.`;
  } else if (normalized === "cryptogames") {
    operatorHeadline = "Homie is ranking filler cash vs real leverage.";
    briefing = `Use games and survey lanes as filler, not the empire. ${laneLine}. Product lane fallback: ${autopilotLine}.`;
  } else if (normalized === "brain" || normalized === "homie") {
    operatorHeadline = "Homie is running the shell, not just one panel.";
    briefing = `Mission load: ${missionCount}. Notes: ${noteCount}. Goals: ${goalCount}. Recovery: ${recoveryLine}. Today’s money move: ${laneLine}.`;
  }

  const moneyFocusLabel = todayBestMove
    ? `${todayBestMove.category} • ${todayBestMove.valueLabel}`
    : nextMoneyMove
    ? `${nextMoneyMove.lane || "Autopilot"} • ${nextMoneyMove.valueLabel}`
    : "Scout a legit income lane";
  const moneyFocusBrief = todayBestMove
    ? `${todayBestMove.title} — ${todayBestMove.fitReason}`
    : nextMoneyMove
    ? `${nextMoneyMove.title} — ${nextMoneyMove.body}`
    : "No strong money lane yet. Refresh Money, Brain, or Income Sniper after logging outcomes.";
  const conversationReadyLabel = recovery.capacity === "high"
    ? "Homie is hot and ready for a real work sprint."
    : recovery.capacity === "medium"
    ? "Homie is ready for a practical check-in and one clean move."
    : "Homie is ready for tiny-step recovery mode coaching.";
  const companionMode = recovery.capacity === "low"
    ? "grounding"
    : recovery.capacity === "high"
    ? "phoenix"
    : "steady";
  const companionHeadline = companionMode === "grounding"
    ? "Homie stays close, grounded, and gentle when the day feels heavy."
    : companionMode === "phoenix"
    ? "Homie channels the spark into one focused push without losing the human vibe."
    : "Homie helps you sort the noise, land one clear move, and keep momentum calm.";
  const companionBrief = companionMode === "grounding"
    ? `Start by settling the signal, then choose one tiny move inside ${panelMeta.title}. ${todayBestMove ? `Best low-friction lane: ${todayBestMove.title}.` : "No pressure — a calm check-in still counts."}`
    : companionMode === "phoenix"
    ? `You're carrying more capacity right now. Homie should keep the plan warm, honest, and focused on one shippable move from ${panelMeta.title}.`
    : `Use Homie like a grounded operator-friend: reflect the situation, sort the thoughts, then commit to one realistic next action from ${panelMeta.title}.`;
  const checkInPrompts = [
    `Check in with me about ${panelMeta.title}.`,
    `Help me sort my thoughts before I act in ${panelMeta.title}.`,
    `Stay with me while I do the next step from ${panelMeta.title}.`,
    companionMode === "grounding"
      ? "Ground me and help me make a tiny plan."
      : companionMode === "phoenix"
      ? "Help me focus and turn this energy into one clean push."
      : "Help me get grounded and pick one clear next move.",
  ];
  const memoryHeadline = memory.relationshipHeadline;
  const memoryBrief = memory.relationshipBrief;
  const memoryPattern = memory.patternLine;

  const quickActions: HomieCoreAction[] = [
    {
      id: "open-homie",
      label: "Open Homie",
      kind: "navigate",
      panelId: "Homie",
    },
    {
      id: "ask-panel",
      label: "Ask about this panel",
      kind: "homie-draft",
      panelId: "Homie",
      prompt: `I'm in ${panelMeta.title}. Give me the best next move here in plain English.`,
    },
    {
      id: "plan-today",
      label: "Plan my next 30m",
      kind: "homie-draft",
      panelId: "Homie",
      prompt: `Based on my current recovery state, plan my next 30 minutes inside FairlyOdd OS.`,
    },
    {
      id: "income-forge",
      label: "Ship one thing today",
      kind: "navigate",
      panelId: "PhoenixIncomeForge",
    },
    {
      id: "ship-one-thing-draft",
      label: "Coach my ship lane",
      kind: "homie-draft",
      panelId: "Homie",
      prompt: `Coach me through shipping one thing today with zero-upfront or low-friction leverage. Use what you remember is already working.`,
    },
  ];
  if (todayBestMove?.panelId) {
    quickActions.push({
      id: "open-best-move-panel",
      label: `Open ${getPanelMeta(todayBestMove.panelId).title}`,
      kind: "navigate",
      panelId: todayBestMove.panelId,
    });
  }

  return {
    generatedAt: Date.now(),
    panelId: panelMeta.id,
    panelTitle: panelMeta.title,
    panelIcon: panelMeta.icon,
    panelSummary: panelCtx.summary,
    shellRole,
    operatorHeadline,
    briefing,
    energyHeadline: recoveryLine,
    missionCount,
    noteCount,
    goalCount,
    recovery,
    todayBestMove,
    nextMoneyMove,
    suggestedPrompts: promptsForPanel(panelMeta.id, todayBestMove).slice(0, clamp(prefs.ai.verbosity === "tight" ? 2 : prefs.ai.verbosity === "deep" ? 4 : 3, 2, 4)),
    quickActions,
    moneyFocusLabel,
    moneyFocusBrief,
    conversationReadyLabel,
    companionMode,
    companionHeadline,
    companionBrief,
    checkInPrompts,
    memoryHeadline,
    memoryBrief,
    memoryPattern,
  };
}
