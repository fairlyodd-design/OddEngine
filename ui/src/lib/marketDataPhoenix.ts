export type PhoenixWatchItem = {
  symbol: string;
  name: string;
  setup: string;
  confidence: number;
  bias: "bullish" | "bearish" | "neutral";
  price: number;
  changePct: number;
  ivRank: number;
  priority: "A" | "B" | "C";
  catalyst: string;
  lane: string;
};

export const PHOENIX_WATCHLIST: PhoenixWatchItem[] = [
  {
    symbol: "SPY",
    name: "S&P 500",
    setup: "range break watch",
    confidence: 82,
    bias: "bullish",
    price: 682.12,
    changePct: 0.64,
    ivRank: 41,
    priority: "A",
    catalyst: "Index grind higher with broad participation",
    lane: "trend",
  },
  {
    symbol: "QQQ",
    name: "Nasdaq 100",
    setup: "trend continuation",
    confidence: 85,
    bias: "bullish",
    price: 609.54,
    changePct: 0.92,
    ivRank: 38,
    priority: "A",
    catalyst: "Mega-cap tech leadership stayed sticky",
    lane: "trend",
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    setup: "momentum pullback",
    confidence: 91,
    bias: "bullish",
    price: 141.88,
    changePct: 1.84,
    ivRank: 47,
    priority: "A",
    catalyst: "AI bid plus semis strength",
    lane: "trend",
  },
  {
    symbol: "HIMS",
    name: "Hims & Hers",
    setup: "lotto squeeze watch",
    confidence: 88,
    bias: "bullish",
    price: 18.74,
    changePct: 5.48,
    ivRank: 63,
    priority: "B",
    catalyst: "Momentum name with high retail attention",
    lane: "momentum",
  },
  {
    symbol: "AMD",
    name: "AMD",
    setup: "base break stalk",
    confidence: 74,
    bias: "neutral",
    price: 176.32,
    changePct: 0.54,
    ivRank: 46,
    priority: "B",
    catalyst: "Base building under prior breakout zone",
    lane: "watch",
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    setup: "failed bounce fade",
    confidence: 68,
    bias: "bearish",
    price: 228.40,
    changePct: -1.22,
    ivRank: 58,
    priority: "C",
    catalyst: "Weak bounce follow-through and headline sensitivity",
    lane: "fade",
  },
];

export const PHOENIX_SECTORS = [
  { id: "tech", label: "Tech", strength: 84, flow: 18, color: "#6ea8fe" },
  { id: "momentum", label: "Momentum", strength: 81, flow: 15, color: "#ff9f43" },
  { id: "index", label: "Index", strength: 76, flow: 9, color: "#2ed573" },
  { id: "health", label: "Health", strength: 61, flow: 4, color: "#7bed9f" },
  { id: "consumer", label: "Consumer", strength: 54, flow: -2, color: "#a29bfe" },
  { id: "auto", label: "Auto", strength: 47, flow: -6, color: "#70a1ff" },
] as const;

export function topPhoenixSignals(limit = 4) {
  return [...PHOENIX_WATCHLIST].sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}

export function sniperSummary() {
  const best = topPhoenixSignals(1)[0];
  return {
    headline: best ? `${best.symbol} is the cleanest current ${best.priority}-grade setup.` : "No active setup.",
    note: best ? `${best.setup} • ${best.confidence}% confidence • ${best.bias} bias` : "Wait for clean structure.",
  };
}
