import type { SignalPack } from "./coinstoreSignals";

export type CopilotLane = "home" | "family" | "trading" | "studio" | "setup";

export function buildHomieTradingCopilot(signal: SignalPack, timeframe: string, notes: string) {
  const opener = signal.bias === "LONG"
    ? "Long bias is on the table, but only if BTC keeps holding the reclaim."
    : signal.bias === "SHORT"
      ? "Short bias is cleaner right now, but only if the breakdown stays disciplined."
      : "I do not love the edge yet. A good wait is better than a forced trade.";

  const discipline = signal.bias === "WAIT"
    ? "Best move: protect capital and wait for a cleaner trigger."
    : `Trade plan: respect invalidation first, then let targets do the work on the ${timeframe} lane.`;

  const noteLane = notes.trim()
    ? `Your notes: ${notes.trim()}`
    : "No extra macro/news notes added yet. Use the notes box when headlines or macro matter.";

  return {
    opener,
    discipline,
    noteLane,
    suggestion:
      signal.bias === "LONG"
        ? "Look for a hold above entry and avoid chasing vertical candles."
        : signal.bias === "SHORT"
          ? "Look for a failed reclaim and avoid shorting an already exhausted move."
          : "Wait for the next reclaim or breakdown to earn your attention.",
  };
}
