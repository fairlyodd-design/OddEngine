import { getPanelMeta, queuePanelAction, runQuickAction } from "./brain";
import { buildHomieCoreSnapshot, seedHomieDraft } from "./homieCore";
import { buildRecoveryAwareIncomeSniperBoard } from "./incomeSniper";
import { buildPhoenixIncomeForgeBoard } from "./incomeForge";
import { buildMoneyAutopilotQueue } from "./moneyAutopilot";
import { buildRecoverySnapshot } from "./recoveryPlanner";
import { noteHomieInteraction } from "./homieMemory";

export type HomieActionRouterArgs = {
  text: string;
  activePanelId: string;
  onNavigate: (id: string) => void;
};

export type HomieActionRouterResult = {
  matched: boolean;
  ok: boolean;
  message: string;
  panelId?: string;
};

const PANEL_ALIASES: Array<{ panelId: string; terms: string[] }> = [
  { panelId: "Trading", terms: ["trading", "trade", "options"] },
  { panelId: "Money", terms: ["money", "income", "cash", "forge"] },
  { panelId: "FamilyBudget", terms: ["budget", "family budget", "bills"] },
  { panelId: "CryptoGames", terms: ["games", "game time", "survey"] },
  { panelId: "Mining", terms: ["mining", "btc", "bitcoin"] },
  { panelId: "Grow", terms: ["grow"] },
  { panelId: "Books", terms: ["writers", "writing", "books", "ebook", "kdp"] },
  { panelId: "Builder", terms: ["builder", "app", "template"] },
  { panelId: "OptionsSaaS", terms: ["gpt", "saas"] },
  { panelId: "Brain", terms: ["brain", "mission control"] },
  { panelId: "Homie", terms: ["homie", "coach", "companion"] },
  { panelId: "Calendar", terms: ["calendar"] },
];

function lowerText(text: string) {
  return String(text || "").trim().toLowerCase();
}

function containsAny(text: string, bits: string[]) {
  return bits.some((bit) => text.includes(bit));
}

function resolvePanelFromText(text: string) {
  const found = PANEL_ALIASES.find((item) => containsAny(text, item.terms));
  return found?.panelId || "";
}

function navigateWithMemory(panelId: string, onNavigate: (id: string) => void, sourceText: string) {
  noteHomieInteraction("action", sourceText, panelId);
  onNavigate(panelId);
  return panelId;
}

export function runHomieActionRouter(args: HomieActionRouterArgs): HomieActionRouterResult {
  const text = lowerText(args.text);
  if (!text) return { matched: false, ok: false, message: "" };

  const screenReadIntent = containsAny(text, ["what's on screen", "whats on screen", "what am i looking at", "screen read", "read this screen"]);
  if (screenReadIntent) {
    try {
      window.dispatchEvent(new CustomEvent("oddengine:homie-voice-action", { detail: { action: "screen-read", source: "homie-router" } }));
    } catch {}
    noteHomieInteraction("voice", args.text, args.activePanelId);
    return { matched: true, ok: true, message: `Homie is reading the ${getPanelMeta(args.activePanelId).title} screen now.`, panelId: args.activePanelId };
  }

  const openPanelIntent = text.startsWith("homie open ") || text.startsWith("open ") || text.startsWith("go to ");
  if (openPanelIntent) {
    const panelId = resolvePanelFromText(text);
    if (panelId) {
      navigateWithMemory(panelId, args.onNavigate, args.text);
      return { matched: true, ok: true, message: `Opening ${getPanelMeta(panelId).title}.`, panelId };
    }
  }

  if (containsAny(text, ["check in with me", "check in", "ground me", "stay with me", "sit with me", "sort my thoughts", "help me think", "help me sort my thoughts"])) {
    const snap = buildHomieCoreSnapshot(args.activePanelId);
    const prompt = containsAny(text, ["ground me", "check in"])
      ? `Check in with me about ${snap.panelTitle}. Keep it grounded, warm, and practical for ${snap.energyHeadline}.`
      : containsAny(text, ["stay with me", "sit with me"])
      ? `Stay with me while I do the next step from ${snap.panelTitle}. Keep me calm, focused, and moving.`
      : `Help me sort my thoughts about ${snap.panelTitle} before I act. Reflect what matters, then give one clear next step.`;
    seedHomieDraft(prompt, { source: "homie-router", panelId: args.activePanelId });
    navigateWithMemory("Homie", args.onNavigate, args.text);
    return { matched: true, ok: true, message: `Opening Homie for a grounded companion check-in from ${snap.panelTitle}.`, panelId: "Homie" };
  }

  if (containsAny(text, ["what makes money today", "best money move", "make money today", "best legit move", "money today"])) {
    const best = buildRecoveryAwareIncomeSniperBoard(6).todayBestMove;
    const panelId = best?.panelId || "Money";
    navigateWithMemory(panelId, args.onNavigate, args.text);
    return {
      matched: true,
      ok: true,
      message: best
        ? `${best.title} is the best legit money move right now. ${best.fitReason}`
        : "Opening Money so Homie can scout the best legit move right now.",
      panelId,
    };
  }

  if (containsAny(text, ["walk me through the next step", "next step", "tiny step", "what should i do next"])) {
    const snap = buildHomieCoreSnapshot(args.activePanelId);
    const prompt = `Walk me through the next step from ${snap.panelTitle}. Keep it tiny, practical, and matched to ${snap.energyHeadline}.`;
    seedHomieDraft(prompt, { source: "homie-router", panelId: args.activePanelId });
    navigateWithMemory("Homie", args.onNavigate, args.text);
    return { matched: true, ok: true, message: `Sending the next-step breakdown to Homie from ${snap.panelTitle}.`, panelId: "Homie" };
  }

  if (containsAny(text, ["route the best money move", "run the best money move", "best move now"])) {
    const queue = buildMoneyAutopilotQueue(8);
    const best = queue.nextMove;
    if (best?.actionId) {
      noteHomieInteraction("action", args.text, best.panelId);
      const result = runQuickAction(best.actionId);
      if (result.panelId) args.onNavigate(result.panelId);
      return { matched: true, ok: result.ok, message: result.ok ? `Running ${best.title}. ${result.message}` : result.message, panelId: result.panelId || best.panelId };
    }
    const fallback = buildRecoveryAwareIncomeSniperBoard(6).todayBestMove;
    const panelId = fallback?.panelId || "Money";
    navigateWithMemory(panelId, args.onNavigate, args.text);
    return { matched: true, ok: true, message: fallback ? `Opening ${getPanelMeta(panelId).title} for ${fallback.title}.` : "Opening Money to find the next move.", panelId };
  }

  if (containsAny(text, ["pin this task", "pin best move", "queue this", "pin the next move"])) {
    const best = buildMoneyAutopilotQueue(8).nextMove || buildRecoveryAwareIncomeSniperBoard(6).todayBestMove;
    if (best?.actionId) {
      queuePanelAction(best.panelId, best.actionId);
      navigateWithMemory(best.panelId, args.onNavigate, args.text);
      return { matched: true, ok: true, message: `Pinned ${best.title} into ${getPanelMeta(best.panelId).title}'s queue.`, panelId: best.panelId };
    }
    return { matched: true, ok: true, message: "Homie could not find a queue-ready move yet. Open Money or Brain and refresh the scans.", panelId: "Money" };
  }

  if (containsAny(text, ["launch the right board", "best board for today", "where should i work", "open the best board"])) {
    const recovery = buildRecoverySnapshot();
    const forge = buildPhoenixIncomeForgeBoard(6);
    const best = buildRecoveryAwareIncomeSniperBoard(6).todayBestMove;
    const panelId = recovery.capacity === "low"
      ? (best?.panelId === "Trading" ? "Money" : best?.panelId || "Money")
      : recovery.capacity === "medium"
        ? (best?.panelId || forge.todayShipLane?.panelId || "Money")
        : (forge.todayShipLane?.panelId || best?.panelId || "Builder");
    navigateWithMemory(panelId, args.onNavigate, args.text);
    return { matched: true, ok: true, message: `Opening ${getPanelMeta(panelId).title} because it fits your ${recovery.mode} / ${recovery.capacity} day best.`, panelId };
  }

  if (containsAny(text, ["income forge", "ship one thing today", "open forge", "what should i ship"])) {
    const forge = buildPhoenixIncomeForgeBoard(6);
    seedHomieDraft(`Coach me through shipping today's best income-forge move: ${forge.todayShipLane?.title || "pick the best sellable"}. Keep it realistic for my recovery level.`, { source: "homie-router", panelId: "PhoenixIncomeForge" });
    navigateWithMemory("PhoenixIncomeForge", args.onNavigate, args.text);
    return { matched: true, ok: true, message: forge.todayShipLane ? `${forge.todayShipLane.title} is today's ship lane. Opening Phoenix Income Forge.` : "Opening Phoenix Income Forge for the ship-one-thing lane.", panelId: "PhoenixIncomeForge" };
  }

  return { matched: false, ok: false, message: "" };
}
