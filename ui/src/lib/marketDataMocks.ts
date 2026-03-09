export type MarketMover = {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  volumeLabel: string;
  trend: "bull" | "bear" | "neutral";
  catalyst: string;
  heat: number;
};

export const MARKET_MOVERS: MarketMover[] = [
  { symbol: "SPY", name: "S&P 500", price: 682.12, changePct: 0.64, volumeLabel: "86.4M", trend: "bull", catalyst: "Index grind higher with broad participation", heat: 82 },
  { symbol: "QQQ", name: "Nasdaq 100", price: 609.54, changePct: 0.92, volumeLabel: "51.2M", trend: "bull", catalyst: "Mega-cap tech leadership stayed sticky", heat: 85 },
  { symbol: "NVDA", name: "NVIDIA", price: 141.88, changePct: 1.84, volumeLabel: "44.9M", trend: "bull", catalyst: "AI bid + semis strength", heat: 91 },
  { symbol: "TSLA", name: "Tesla", price: 228.4, changePct: -1.22, volumeLabel: "71.3M", trend: "bear", catalyst: "Weak bounce follow-through and headline sensitivity", heat: 68 },
  { symbol: "HIMS", name: "Hims & Hers", price: 18.74, changePct: 5.48, volumeLabel: "28.7M", trend: "bull", catalyst: "Momentum name with high retail attention", heat: 88 },
  { symbol: "AMD", name: "AMD", price: 176.32, changePct: 0.54, volumeLabel: "39.8M", trend: "neutral", catalyst: "Base building under prior breakout zone", heat: 74 },
];

export const WATCHLIST = MARKET_MOVERS.map((m) => m.symbol);
