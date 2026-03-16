export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type SignalBias = "LONG" | "SHORT" | "WAIT";

export type SignalPack = {
  bias: SignalBias;
  confidence: number;
  score: number;
  entry: string;
  invalidation: string;
  targets: string[];
  explanation: string;
  emaFast: number;
  emaSlow: number;
  rsi: number;
  changePct: number;
};

export type CoinstoreConfig = {
  tickSize: number;
  contractSize: number;
  makerFeeRate: number;
  takerFeeRate: number;
  leverageTiers: number[];
};

const seededConfig: CoinstoreConfig = {
  tickSize: 0.5,
  contractSize: 0.001,
  makerFeeRate: 0.00025,
  takerFeeRate: 0.0006,
  leverageTiers: [100, 50, 20, 10, 5, 4, 2],
};

function hashSeed(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

export function seedCandles(label: string, timeframe: "1m" | "5m" | "15m"): Candle[] {
  const seed = hashSeed(label + timeframe);
  const length = timeframe === "1m" ? 90 : timeframe === "5m" ? 72 : 60;
  const stepMs = timeframe === "1m" ? 60_000 : timeframe === "5m" ? 300_000 : 900_000;
  const now = Date.now();
  let base = timeframe === "1m" ? 68340 : timeframe === "5m" ? 68220 : 67980;
  const candles: Candle[] = [];
  for (let i = 0; i < length; i += 1) {
    const wave = Math.sin((i + seed % 11) / (timeframe === "1m" ? 4 : timeframe === "5m" ? 5 : 6));
    const drift = timeframe === "1m" ? 2.1 : timeframe === "5m" ? 6.4 : 12.7;
    const noise = (((seed >> (i % 16)) & 7) - 3) * (timeframe === "1m" ? 1.2 : timeframe === "5m" ? 2.8 : 4.5);
    const open = base;
    const delta = wave * drift + noise;
    const close = Math.max(100, open + delta);
    const high = Math.max(open, close) + Math.abs(delta) * 0.6 + 2.5;
    const low = Math.min(open, close) - Math.abs(delta) * 0.6 - 2.5;
    const volume = Math.round(120 + Math.abs(delta) * 45 + (i % 7) * 12);
    candles.push({
      time: now - (length - i) * stepMs,
      open,
      high,
      low,
      close,
      volume,
    });
    base = close;
  }
  return candles;
}

export async function fetchCoinstoreConfig(): Promise<CoinstoreConfig> {
  try {
    const res = await fetch("https://futures.coinstore.com/api/configs/public");
    if (!res.ok) throw new Error("config request failed");
    const json = await res.json();
    const contracts = json?.data?.contracts || [];
    const btc = contracts.find((item: any) => item?.name === "BTCUSDT");
    if (!btc) return seededConfig;
    const tiers = Array.isArray(btc.riskLimits) ? btc.riskLimits.map((item: any) => Number(item?.leverage)).filter(Boolean) : seededConfig.leverageTiers;
    return {
      tickSize: Number(btc.tickSize || seededConfig.tickSize),
      contractSize: Number(btc.contractSize || seededConfig.contractSize),
      makerFeeRate: Number(btc.makerFeeRate || seededConfig.makerFeeRate),
      takerFeeRate: Number(btc.takerFeeRate || seededConfig.takerFeeRate),
      leverageTiers: tiers.length ? tiers : seededConfig.leverageTiers,
    };
  } catch {
    return seededConfig;
  }
}

export function ema(values: number[], period: number): number[] {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i += 1) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

export function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period || 0.0001;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function volumeBias(candles: Candle[]): number {
  if (candles.length < 6) return 0;
  const recent = candles.slice(-5).reduce((sum, c) => sum + c.volume, 0) / 5;
  const base = candles.slice(-20, -5).reduce((sum, c) => sum + c.volume, 0) / Math.max(1, candles.slice(-20, -5).length);
  return (recent - base) / Math.max(1, base);
}

export function buildSignalPack(candles: Candle[]): SignalPack {
  const closes = candles.map((c) => c.close);
  const last = closes[closes.length - 1];
  const first = closes[Math.max(0, closes.length - 15)];
  const changePct = ((last - first) / first) * 100;
  const emaFastSeries = ema(closes, 9);
  const emaSlowSeries = ema(closes, 21);
  const emaFast = emaFastSeries[emaFastSeries.length - 1] ?? last;
  const emaSlow = emaSlowSeries[emaSlowSeries.length - 1] ?? last;
  const rsiValue = rsi(closes);
  const volBias = volumeBias(candles);

  let score = 0;
  score += emaFast > emaSlow ? 26 : -26;
  score += changePct > 0 ? 18 : -18;
  score += rsiValue > 56 ? 14 : rsiValue < 44 ? -14 : 0;
  score += volBias > 0.12 ? 12 : volBias < -0.12 ? -12 : 0;

  let bias: SignalBias = "WAIT";
  if (score >= 24) bias = "LONG";
  else if (score <= -24) bias = "SHORT";

  const confidence = Math.min(92, Math.max(28, Math.round(45 + Math.abs(score) * 0.9)));
  const baseRisk = Math.max(18, Math.abs(last - emaSlow));
  const entryLow = bias === "SHORT" ? last - baseRisk * 0.15 : last - baseRisk * 0.35;
  const entryHigh = bias === "SHORT" ? last + baseRisk * 0.35 : last + baseRisk * 0.15;
  const invalidation = bias === "SHORT" ? last + baseRisk * 0.9 : last - baseRisk * 0.9;
  const targets = bias === "SHORT"
    ? [last - baseRisk * 0.9, last - baseRisk * 1.6, last - baseRisk * 2.4]
    : [last + baseRisk * 0.9, last + baseRisk * 1.6, last + baseRisk * 2.4];

  let explanation = "Market is mixed. Wait for a reclaim or breakdown with cleaner confirmation.";
  if (bias === "LONG") {
    explanation = "Fast trend is above slow trend, momentum is constructive, and the setup leans continuation long if price holds the entry lane.";
  } else if (bias === "SHORT") {
    explanation = "Fast trend is below slow trend, momentum is weak, and the setup leans continuation short if breakdown pressure stays clean.";
  }

  return {
    bias,
    confidence,
    score,
    entry: `${formatPrice(entryLow)} – ${formatPrice(entryHigh)}`,
    invalidation: formatPrice(invalidation),
    targets: targets.map(formatPrice),
    explanation,
    emaFast,
    emaSlow,
    rsi: rsiValue,
    changePct,
  };
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value);
}

export function buildChartPath(candles: Candle[], width: number, height: number) {
  if (!candles.length) return "";
  const closes = candles.map((c) => c.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = Math.max(1, max - min);
  return closes.map((price, idx) => {
    const x = (idx / Math.max(1, closes.length - 1)) * width;
    const y = height - ((price - min) / range) * height;
    return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

export function buildNewsIntel(signal: SignalPack) {
  if (signal.bias === "LONG") {
    return [
      "Momentum tone favors longs, but only if price keeps reclaiming above the fast trend.",
      "Watch for funding crowding before overcommitting to breakout continuation.",
      "Best entries usually come on a controlled pullback, not the first panic candle."
    ];
  }
  if (signal.bias === "SHORT") {
    return [
      "Momentum tone favors shorts, but only if breakdown pressure holds below the fast trend.",
      "Watch for short-covering spikes near invalidation; that is where weak shorts get trapped.",
      "Best entries usually come after a failed reclaim, not after an exhausted dump candle."
    ];
  }
  return [
    "No clear edge yet. Let the market show hand first.",
    "Wait for a cleaner reclaim above trend or a cleaner breakdown below support.",
    "Skip mediocre setups; the no-trade button is part of the strategy."
  ];
}
