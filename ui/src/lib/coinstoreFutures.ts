export type CoinstoreCandle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type CoinstoreSnapshot = {
  markPrice: number;
  fundingRate: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  indexPrice: number;
  volume24h: number;
  turnover24h: number;
};

export type TimeframeId = "1m" | "3m" | "5m" | "15m";
export type Bias = "LONG" | "SHORT" | "WAIT";
export type Tone = "good" | "warn" | "bad" | "muted";

export type TimeframeSignal = {
  timeframe: TimeframeId;
  bias: Bias;
  score: number;
  confidence: number;
  trend: string;
  regime: string;
  setupName: string;
  reason: string;
  emaFast: number;
  emaSlow: number;
  vwap: number;
  rsi: number;
  macdHist: number;
  volumeRatio: number;
};

export type PhoenixSetupCard = {
  title: string;
  subtitle: string;
  tone: Tone;
  why: string;
};

export type PhoenixPlan = {
  primaryBias: Bias;
  phoenixScore: number;
  confidence: number;
  alignment: string;
  setupName: string;
  regime: string;
  trend: string;
  entryZone: string;
  invalidation: string;
  targets: string[];
  riskReward: string;
  whyNow: string;
  killSwitch: string;
  executionNotes: string[];
  homieLines: string[];
  intelHeadline: string;
  intelBody: string;
  setupCards: PhoenixSetupCard[];
};

export type CoinstoreKeys = {
  apiKey: string;
  apiSecret: string;
  note: string;
};

export type PhoenixPrefs = {
  mode25x: boolean;
};

export type MacroIntel = {
  marketTone: "risk-on" | "balanced" | "risk-off";
  headline: string;
  summary: string;
  bullets: string[];
  warnings: string[];
  scorecards: { label: string; value: string; tone: Tone }[];
};

export const COINSTORE_KEYS_STORAGE = "oddengine:coinstore:futures:keys:v1";
export const PHOENIX_PREFS_STORAGE = "oddengine:coinstore:phoenix:prefs:v1";

export const TIMEFRAMES: { id: TimeframeId; label: string; range: string }[] = [
  { id: "1m", label: "1m", range: "60000" },
  { id: "3m", label: "3m", range: "180000" },
  { id: "5m", label: "5m", range: "300000" },
  { id: "15m", label: "15m", range: "900000" },
];

export const FALLBACK_SNAPSHOT: CoinstoreSnapshot = {
  markPrice: 70668.9,
  fundingRate: 0.000033,
  bestBid: 70667.8,
  bestAsk: 70669.2,
  spread: 1.4,
  indexPrice: 70662.4,
  volume24h: 12543,
  turnover24h: 891234567,
};

export function loadCoinstoreKeys(): CoinstoreKeys {
  if (typeof window === "undefined") return { apiKey: "", apiSecret: "", note: "" };
  try {
    const raw = window.localStorage.getItem(COINSTORE_KEYS_STORAGE);
    return raw ? JSON.parse(raw) : { apiKey: "", apiSecret: "", note: "" };
  } catch {
    return { apiKey: "", apiSecret: "", note: "" };
  }
}

export function saveCoinstoreKeys(keys: CoinstoreKeys) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COINSTORE_KEYS_STORAGE, JSON.stringify(keys));
  } catch {
    // local-only staging
  }
}

export function loadPhoenixPrefs(): PhoenixPrefs {
  if (typeof window === "undefined") return { mode25x: true };
  try {
    const raw = window.localStorage.getItem(PHOENIX_PREFS_STORAGE);
    return raw ? { mode25x: !!JSON.parse(raw).mode25x } : { mode25x: true };
  } catch {
    return { mode25x: true };
  }
}

export function savePhoenixPrefs(prefs: PhoenixPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PHOENIX_PREFS_STORAGE, JSON.stringify(prefs));
  } catch {
    // local-only staging
  }
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function seedMockCandles(seed = 70650, tf: TimeframeId = "5m"): CoinstoreCandle[] {
  const rows: CoinstoreCandle[] = [];
  let price = seed;
  const mult = tf === "1m" ? 1 : tf === "3m" ? 1.2 : tf === "5m" ? 1.5 : 2.4;
  for (let i = 0; i < 96; i += 1) {
    const wave = Math.sin(i / 5) * 34 * mult + Math.cos(i / 9) * 16 * mult;
    const drift = i > 56 ? 4.5 * mult : -1.25 * mult;
    const open = price;
    const close = Math.max(1, open + wave * 0.16 + drift);
    const high = Math.max(open, close) + 12 * mult + Math.abs(Math.sin(i / 2)) * 8;
    const low = Math.min(open, close) - 12 * mult - Math.abs(Math.cos(i / 2)) * 7;
    const volume = 170 + (i % 11) * 28 + Math.abs(Math.sin(i / 2)) * 130 * mult;
    rows.push({
      ts: Date.now() - (96 - i) * 60_000,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: round(volume),
    });
    price = close;
  }
  return rows;
}

export function ema(values: number[], period: number): number[] {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  values.forEach((value, index) => {
    if (index === 0) {
      out.push(value);
      prev = value;
      return;
    }
    prev = value * k + prev * (1 - k);
    out.push(round(prev, 2));
  });
  return out;
}

export function rsi(values: number[], period = 14): number {
  if (values.length < 2) return 50;
  let gains = 0;
  let losses = 0;
  const start = Math.max(1, values.length - period);
  for (let i = start; i < values.length; i += 1) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  if (losses === 0) return 100;
  const rs = gains / Math.max(losses, 0.000001);
  return round(100 - 100 / (1 + rs), 1);
}

export function macd(values: number[]) {
  const fast = ema(values, 12);
  const slow = ema(values, 26);
  const line = values.map((_, index) => round((fast[index] ?? 0) - (slow[index] ?? 0), 3));
  const signal = ema(line, 9);
  const hist = line.map((value, index) => round(value - (signal[index] ?? 0), 3));
  return { line, signal, hist };
}

export function vwap(candles: CoinstoreCandle[]) {
  let pv = 0;
  let volume = 0;
  candles.forEach((candle) => {
    const typical = (candle.high + candle.low + candle.close) / 3;
    pv += typical * candle.volume;
    volume += candle.volume;
  });
  return volume ? round(pv / volume, 2) : candles.at(-1)?.close ?? 0;
}

export function averageVolume(candles: CoinstoreCandle[], lookback = 20) {
  const slice = candles.slice(-lookback);
  if (!slice.length) return 0;
  return round(slice.reduce((sum, candle) => sum + candle.volume, 0) / slice.length, 1);
}

export function candlesToPath(candles: CoinstoreCandle[], width = 780, height = 240) {
  if (!candles.length) return "";
  const closes = candles.map((c) => c.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = Math.max(1, max - min);
  return candles
    .map((candle, index) => {
      const x = (index / Math.max(1, candles.length - 1)) * width;
      const y = height - ((candle.close - min) / range) * (height - 20) - 10;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function fmtPrice(value: number) {
  return round(value, 1).toFixed(1);
}

export function evaluateTimeframe(
  timeframe: TimeframeId,
  candles: CoinstoreCandle[],
  snapshot: CoinstoreSnapshot,
  mode25x: boolean
): TimeframeSignal {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const current = closes.at(-1) ?? snapshot.markPrice;
  const e9Series = ema(closes, 9);
  const e21Series = ema(closes, 21);
  const e9 = e9Series.at(-1) ?? current;
  const e21 = e21Series.at(-1) ?? current;
  const r = rsi(closes, 14);
  const currentVwap = vwap(candles);
  const macdHist = macd(closes).hist.at(-1) ?? 0;
  const avgVol = averageVolume(candles, 20);
  const currentVol = candles.at(-1)?.volume ?? avgVol;
  const recentHigh = Math.max(...highs.slice(-12));
  const recentLow = Math.min(...lows.slice(-12));
  const atrProxy = round((recentHigh - recentLow) / 4, 1);
  const spreadPct = snapshot.markPrice ? (snapshot.spread / snapshot.markPrice) * 100 : 0;
  const indexGap = snapshot.markPrice - snapshot.indexPrice;
  const trendDelta = e9 - e21;
  const volumeRatio = avgVol ? currentVol / avgVol : 1;

  const leveragePenalty = mode25x ? 1.2 : 1;
  let score = 0;
  if (trendDelta > 0) score += 20;
  else score -= 20;

  if (current > currentVwap) score += 14;
  else score -= 14;

  if (macdHist > 0) score += 12;
  else score -= 12;

  if (r > 54 && r < (mode25x ? 68 : 72)) score += 10;
  if (r < 46 && r > (mode25x ? 32 : 28)) score -= 10;

  if (volumeRatio > 1.1) score += 8;
  if (volumeRatio < 0.9) score -= 5;

  if (spreadPct > (mode25x ? 0.02 : 0.03)) score -= 14 * leveragePenalty;
  if (Math.abs(snapshot.fundingRate) > (mode25x ? 0.0006 : 0.0008)) score -= 8 * leveragePenalty;
  if (Math.abs(indexGap) > atrProxy * (mode25x ? 0.45 : 0.6)) score -= 6 * leveragePenalty;

  const confidence = Math.min(95, Math.max(18, Math.round(Math.abs(score))));
  const bias: Bias = score > 18 ? "LONG" : score < -18 ? "SHORT" : "WAIT";

  let regime = "compression";
  if (volumeRatio > 1.18 && Math.abs(trendDelta) > atrProxy * 0.1) regime = "momentum";
  else if (Math.abs(current - currentVwap) < atrProxy * 0.3) regime = "VWAP battle";
  else if (bias !== "WAIT" && Math.abs(current - (bias === "LONG" ? recentHigh : recentLow)) < atrProxy * 0.35) regime = "breakout test";
  else if (bias !== "WAIT") regime = "trend continuation";

  const trend = trendDelta > 0 ? "uptrend" : trendDelta < 0 ? "downtrend" : "flat / compressing";

  const setupName =
    bias === "WAIT"
      ? "No-trade / preserve ammo"
      : bias === "LONG"
      ? regime === "VWAP battle"
        ? "VWAP reclaim long"
        : regime === "breakout test"
        ? "Breakout continuation long"
        : "Momentum continuation long"
      : regime === "VWAP battle"
      ? "VWAP rejection short"
      : regime === "breakout test"
      ? "Breakdown continuation short"
      : "Momentum continuation short";

  const reason =
    bias === "WAIT"
      ? `On ${timeframe}, edge is mixed. ${mode25x ? "25x mode is filtering this out." : "The alignment is not clean enough."}`
      : bias === "LONG"
      ? `On ${timeframe}, price is holding above value well enough for a long-biased scalp if the reclaim stays clean.`
      : `On ${timeframe}, structure leans down and weak pops are better fade candidates than forced longs.`;

  return {
    timeframe,
    bias,
    score,
    confidence,
    trend,
    regime,
    setupName,
    reason,
    emaFast: round(e9, 1),
    emaSlow: round(e21, 1),
    vwap: round(currentVwap, 1),
    rsi: r,
    macdHist,
    volumeRatio: round(volumeRatio, 2),
  };
}

export function buildPhoenixPlan(
  signals: TimeframeSignal[],
  snapshot: CoinstoreSnapshot,
  mode25x: boolean
): PhoenixPlan {
  const longCount = signals.filter((s) => s.bias === "LONG").length;
  const shortCount = signals.filter((s) => s.bias === "SHORT").length;
  const waitCount = signals.filter((s) => s.bias === "WAIT").length;
  const scoreSum = signals.reduce((sum, signal) => sum + signal.score, 0);
  const avgConfidence = Math.round(
    signals.reduce((sum, signal) => sum + signal.confidence, 0) / Math.max(1, signals.length)
  );
  const primaryBias: Bias =
    longCount >= 3 ? "LONG" :
    shortCount >= 3 ? "SHORT" :
    Math.abs(scoreSum) > 40
      ? scoreSum > 0 ? "LONG" : "SHORT"
      : "WAIT";

  const alignment =
    primaryBias === "WAIT"
      ? `${waitCount} of ${signals.length} frames want patience`
      : `${primaryBias} bias on ${primaryBias === "LONG" ? longCount : shortCount}/${signals.length} frames`;

  const dominant = signals.find((signal) => signal.timeframe === "5m") ?? signals[0];
  const current = snapshot.markPrice;
  const atrProxy = Math.max(18, Math.abs(snapshot.bestAsk - snapshot.bestBid) * 10 + current * 0.00045);
  const entryLow = primaryBias === "LONG" ? current - atrProxy * 0.14 : current - atrProxy * 0.08;
  const entryHigh = primaryBias === "LONG" ? current + atrProxy * 0.08 : current + atrProxy * 0.14;
  const invalidation = primaryBias === "LONG"
    ? current - atrProxy * (mode25x ? 0.52 : 0.7)
    : primaryBias === "SHORT"
    ? current + atrProxy * (mode25x ? 0.52 : 0.7)
    : current - atrProxy * 0.35;

  const target1 = primaryBias === "LONG" ? current + atrProxy * 0.55 : current - atrProxy * 0.55;
  const target2 = primaryBias === "LONG" ? current + atrProxy * 1.0 : current - atrProxy * 1.0;
  const target3 = primaryBias === "LONG" ? current + atrProxy * 1.55 : current - atrProxy * 1.55;
  const risk = Math.abs(current - invalidation);
  const reward = Math.abs(target2 - current);
  const riskReward = risk > 0 ? `${round(reward / risk, 2)}R to T2` : "n/a";

  const phoenixScore = Math.min(
    99,
    Math.max(
      12,
      Math.round(
        (Math.abs(scoreSum) / Math.max(1, signals.length)) +
          (primaryBias === "WAIT" ? -8 : 14) +
          (mode25x ? -4 : 0)
      )
    )
  );

  const setupName =
    primaryBias === "WAIT"
      ? "Phoenix patience filter"
      : primaryBias === "LONG"
      ? dominant.regime === "VWAP battle"
        ? "Phoenix VWAP reclaim long"
        : dominant.regime === "breakout test"
        ? "Phoenix breakout hold long"
        : "Phoenix momentum long"
      : dominant.regime === "VWAP battle"
      ? "Phoenix VWAP rejection short"
      : dominant.regime === "breakout test"
      ? "Phoenix breakdown retest short"
      : "Phoenix momentum short";

  const whyNow =
    primaryBias === "WAIT"
      ? "Multi-timeframe agreement is not clean enough. The sniper edge is not there yet."
      : primaryBias === "LONG"
      ? "Shorter frames are leaning constructive and the higher intraday frames are not fighting the setup."
      : "Shorter frames are leaning weak and the higher intraday frames are not bailing the market out yet.";

  const killSwitch =
    primaryBias === "WAIT"
      ? "Do nothing until 1m/3m/5m line up better."
      : primaryBias === "LONG"
      ? "Kill the trade if price loses the entry zone cleanly or spread/funding worsen fast."
      : "Kill the trade if price reclaims and holds above the entry zone or spread blows out.";

  const intelHeadline =
    primaryBias === "WAIT"
      ? "No edge. Protect ammo."
      : primaryBias === "LONG"
      ? `${setupName} is viable if reclaim/hold stays clean.`
      : `${setupName} is viable if weak pops keep failing.`;

  const intelBody =
    primaryBias === "WAIT"
      ? "The Phoenix read sees mixed alignment across the 1m / 3m / 5m / 15m stack. In 25x mode, that is a pass."
      : primaryBias === "LONG"
      ? `Momentum is constructive on the lower frames and the higher intraday read is not blocking the move. Spread and funding still matter more than excitement.`
      : `The lower-frame weakness is strong enough to stalk shorts, but only if bounces keep failing and the execution friction stays acceptable.`;

  const executionNotes =
    primaryBias === "WAIT"
      ? [
          "No-trade is still a win when the edge is mixed.",
          mode25x ? "25x mode is intentionally harsher. Wait for cleaner alignment." : "Wait for a cleaner reclaim/rejection.",
          "Preserve the $25 sniper ammo for a setup with real agreement.",
        ]
      : primaryBias === "LONG"
      ? [
          mode25x ? "25x mode: take tighter entries and smaller targets first." : "Do not chase a stretched candle.",
          "Scale at target 1; keep target 2/3 for the clean runner only.",
          "If spread widens or funding gets crowded, reduce size or pass.",
        ]
      : [
          mode25x ? "25x mode: weak-bounce rejection only, no emotional market sells." : "Short the rejection, not the panic.",
          "Take first money at target 1 and reassess before holding for target 2/3.",
          "If the market reclaims and holds, walk away fast.",
        ];

  const homieLines =
    primaryBias === "WAIT"
      ? [
          "No edge yet. Let the market earn your attention.",
          mode25x ? "At 25x, patience is part of the setup." : "The cleanest move here may be no move.",
        ]
      : primaryBias === "LONG"
      ? [
          "Long bias, but only if price behaves in the entry zone.",
          "This is a sniper continuation idea, not a chase idea.",
        ]
      : [
          "Short bias, but let weak rallies fail first.",
          "This is cleaner as a rejection short than an emotional slam-sell.",
        ];

  const setupCards: PhoenixSetupCard[] = signals.map((signal) => ({
    title: `${signal.timeframe} ${signal.setupName}`,
    subtitle: `${signal.bias} · ${signal.regime}`,
    tone: signal.bias === "LONG" ? "good" : signal.bias === "SHORT" ? "bad" : "warn",
    why: signal.reason,
  }));

  return {
    primaryBias,
    phoenixScore,
    confidence: avgConfidence,
    alignment,
    setupName,
    regime: dominant.regime,
    trend: dominant.trend,
    entryZone: `${fmtPrice(entryLow)} – ${fmtPrice(entryHigh)}`,
    invalidation: fmtPrice(invalidation),
    targets: [fmtPrice(target1), fmtPrice(target2), fmtPrice(target3)],
    riskReward,
    whyNow,
    killSwitch,
    executionNotes,
    homieLines,
    intelHeadline,
    intelBody,
    setupCards,
  };
}

export function buildMacroIntel(
  signals: TimeframeSignal[],
  snapshot: CoinstoreSnapshot,
  plan: PhoenixPlan,
  mode25x: boolean
): MacroIntel {
  const longCount = signals.filter((signal) => signal.bias === "LONG").length;
  const shortCount = signals.filter((signal) => signal.bias === "SHORT").length;
  const waitCount = signals.filter((signal) => signal.bias === "WAIT").length;
  const avgRsi = signals.reduce((sum, signal) => sum + signal.rsi, 0) / Math.max(1, signals.length);
  const avgVol = signals.reduce((sum, signal) => sum + signal.volumeRatio, 0) / Math.max(1, signals.length);
  const spreadPct = snapshot.markPrice ? (snapshot.spread / snapshot.markPrice) * 100 : 0;
  const fundingPct = snapshot.fundingRate * 100;
  const indexGapPct = snapshot.markPrice
    ? ((snapshot.markPrice - snapshot.indexPrice) / snapshot.markPrice) * 100
    : 0;

  let marketTone: MacroIntel["marketTone"] = "balanced";
  if (plan.primaryBias === "LONG" && avgVol > 1.05 && spreadPct < 0.03) marketTone = "risk-on";
  if (plan.primaryBias === "SHORT" || spreadPct > 0.03 || Math.abs(fundingPct) > 0.08) marketTone = "risk-off";

  const headline =
    marketTone === "risk-on"
      ? "Momentum and flow are supportive, but execution still matters more than excitement."
      : marketTone === "risk-off"
      ? "Execution friction or crowding is rising — this is a protect-capital environment first."
      : "The market is mixed. Let alignment, not hope, decide the trade.";

  const summary =
    plan.primaryBias === "WAIT"
      ? "Macro/news-style read is neutral to messy. The lower frames are not giving a clean enough edge to justify aggressive sniper exposure."
      : plan.primaryBias === "LONG"
      ? "The market is leaning constructive, but only if the reclaim keeps holding and crowding stays manageable."
      : "The tape is leaning weak enough for shorts, but only if rallies keep failing and the move does not get too crowded.";

  const bullets = [
    `${longCount}/${signals.length} frames lean long, ${shortCount}/${signals.length} lean short, ${waitCount}/${signals.length} want patience.`,
    `Average RSI across the stack is ${round(avgRsi, 1)}, which ${avgRsi > 65 ? "is getting hot" : avgRsi < 35 ? "is leaning washed out" : "still leaves room for continuation"}.`,
    `Average relative volume is ${round(avgVol, 2)}x, so participation is ${avgVol > 1.12 ? "supportive" : avgVol < 0.9 ? "thin" : "average"}.`,
  ];

  const warnings: string[] = [];
  if (spreadPct > (mode25x ? 0.02 : 0.03)) {
    warnings.push(`Spread is ${spreadPct.toFixed(3)}%, which is wider than ideal for a sniper scalp${mode25x ? " in 25x mode" : ""}.`);
  }
  if (Math.abs(fundingPct) > (mode25x ? 0.06 : 0.08)) {
    warnings.push(`Funding is ${fundingPct.toFixed(4)}%, which hints at crowding risk.`);
  }
  if (Math.abs(indexGapPct) > 0.05) {
    warnings.push(`Mark/index gap is ${indexGapPct.toFixed(3)}%, so the move may be overstretched or dislocated.`);
  }
  if (plan.primaryBias === "WAIT") {
    warnings.push("The sniper read is still mixed. No-trade remains a valid best decision.");
  }
  if (!warnings.length) {
    warnings.push("No major macro friction flags from saved local state. Focus on execution quality and alignment.");
  }

  return {
    marketTone,
    headline,
    summary,
    bullets,
    warnings,
    scorecards: [
      {
        label: "Market tone",
        value: marketTone,
        tone: marketTone === "risk-on" ? "good" : marketTone === "risk-off" ? "bad" : "muted",
      },
      {
        label: "Funding",
        value: `${fundingPct.toFixed(4)}%`,
        tone: Math.abs(fundingPct) > (mode25x ? 0.06 : 0.08) ? "warn" : "muted",
      },
      {
        label: "Spread",
        value: `${spreadPct.toFixed(3)}%`,
        tone: spreadPct > (mode25x ? 0.02 : 0.03) ? "warn" : "good",
      },
      {
        label: "Mark vs index",
        value: `${indexGapPct.toFixed(3)}%`,
        tone: Math.abs(indexGapPct) > 0.05 ? "warn" : "muted",
      },
    ],
  };
}
