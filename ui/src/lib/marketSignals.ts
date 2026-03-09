import { MARKET_MOVERS } from "./marketDataMocks";

export type SignalTone = "good" | "warn" | "bad" | "muted";
export type MarketSignal = {
  symbol: string;
  lane: string;
  headline: string;
  tone: SignalTone;
  confidence: number;
  setup: string;
};

export const MARKET_SIGNALS: MarketSignal[] = MARKET_MOVERS.map((m) => ({
  symbol: m.symbol,
  lane: m.trend === "bull" ? "trend" : m.trend === "bear" ? "fade" : "watch",
  headline: `${m.symbol} ${m.trend === "bull" ? "holding strength" : m.trend === "bear" ? "needs reclaim" : "coiling near inflection"}`,
  tone: m.trend === "bull" ? "good" : m.trend === "bear" ? "bad" : "warn",
  confidence: Math.max(52, Math.min(96, m.heat)),
  setup: m.trend === "bull" ? "break + hold" : m.trend === "bear" ? "pop fade" : "range rotation",
}));
