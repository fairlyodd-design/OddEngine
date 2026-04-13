import type { MoneyAutopilotQueueItem } from "./moneyAutopilot";
import type { MoneyFeedbackOutcome, MoneyFeedbackOutcomeSource } from "./moneyScore";

export type PromptedMoneyOutcome = {
  outcome?: MoneyFeedbackOutcome;
  realizedUsd?: number | null;
  note?: string;
  outcomeSource?: MoneyFeedbackOutcomeSource;
};

function parseMaybeNumber(raw: string | null | undefined) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function inferOutcome(amount: number | null | undefined, fallback: MoneyFeedbackOutcome = "win"): MoneyFeedbackOutcome {
  if (amount == null) return fallback;
  if (amount < 0) return "loss";
  if (amount === 0) return "mixed";
  return "win";
}

function normalizeOutcome(raw: string | null | undefined, fallback: MoneyFeedbackOutcome): MoneyFeedbackOutcome {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "win" || value === "mixed" || value === "loss") return value;
  return fallback;
}

export function promptMoneyOutcomeCapture(move: Pick<MoneyAutopilotQueueItem, "title" | "amountUsd" | "kind" | "lane" | "panelId">): PromptedMoneyOutcome | undefined {
  try {
    const wantsCapture = window.confirm(
      `Capture the real result for \"${move.title}\"?\n\nOK = log actual dollars made or saved\nCancel = mark done using the default estimated result.`
    );
    if (!wantsCapture) return undefined;

    const moveKind = String((move as any).kind || "");
    const amountPrompt = moveKind === "save"
      ? "Actual dollars saved. Use a negative number if it backfired, or 0 for a wash. Leave blank to keep the estimate."
      : "Actual dollars made. Use a negative number for a loss, or 0 for a wash. Leave blank to keep the estimate.";
    const amountRaw = window.prompt(amountPrompt, move.amountUsd != null ? String(move.amountUsd) : "");
    const parsedAmount = parseMaybeNumber(amountRaw);
    const defaultOutcome = inferOutcome(parsedAmount, moveKind === "protect" ? "mixed" : "win");
    const outcomeRaw = window.prompt("Outcome type? win / mixed / loss", defaultOutcome);
    const outcome = normalizeOutcome(outcomeRaw, defaultOutcome);
    const noteRaw = window.prompt("Optional note for the money log", "");
    const note = noteRaw && String(noteRaw).trim() ? String(noteRaw).trim() : undefined;
    return {
      outcome,
      realizedUsd: parsedAmount,
      note,
      outcomeSource: parsedAmount != null ? "actual" : "estimated",
    };
  } catch {
    return undefined;
  }
}
