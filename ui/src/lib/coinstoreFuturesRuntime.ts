import {
  CoinstoreCandle,
  CoinstoreSnapshot,
  MacroIntel,
  PhoenixPlan,
  TimeframeSignal,
  ema,
  vwap,
} from "./coinstoreFutures";

export type HeikinAshiBody = {
  x: number;
  width: number;
  wickHighY: number;
  wickLowY: number;
  bodyY: number;
  bodyH: number;
  bullish: boolean;
};

export type HeikinAshiSvg = {
  bodies: HeikinAshiBody[];
  ema9: string;
  ema21: string;
  vwapLine: string;
};

export type PhoenixCoachCue = {
  key: string;
  label: string;
  detail: string;
  tone: "good" | "warn" | "bad" | "muted";
};

type HeikinAshiRow = {
  open: number;
  high: number;
  low: number;
  close: number;
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buildLinePath(values: number[], min: number, max: number, width: number, height: number) {
  if (!values.length) return "";
  const range = Math.max(1, max - min);
  const top = 10;
  const bottom = height - 10;
  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = bottom - ((value - min) / range) * (bottom - top);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function buildHeikinAshiSvg(candles: CoinstoreCandle[], width = 780, height = 240): HeikinAshiSvg {
  if (!Array.isArray(candles) || candles.length === 0) {
    return { bodies: [], ema9: "", ema21: "", vwapLine: "" };
  }

  const ha: HeikinAshiRow[] = [];
  let prevOpen = (candles[0].open + candles[0].close) / 2;
  let prevClose = (candles[0].open + candles[0].high + candles[0].low + candles[0].close) / 4;

  for (let i = 0; i < candles.length; i += 1) {
    const candle = candles[i];
    const haClose = (candle.open + candle.high + candle.low + candle.close) / 4;
    const haOpen = i === 0 ? prevOpen : (prevOpen + prevClose) / 2;
    const haHigh = Math.max(candle.high, haOpen, haClose);
    const haLow = Math.min(candle.low, haOpen, haClose);
    ha.push({ open: round(haOpen), high: round(haHigh), low: round(haLow), close: round(haClose) });
    prevOpen = haOpen;
    prevClose = haClose;
  }

  const closes = candles.map((c) => c.close);
  const ema9Values = ema(closes, 9);
  const ema21Values = ema(closes, 21);
  const vwapValue = vwap(candles);
  const vwapValues = closes.map(() => vwapValue);

  const highs = ha.map((row) => row.high);
  const lows = ha.map((row) => row.low);
  const indicatorMax = Math.max(...ema9Values, ...ema21Values, ...vwapValues);
  const indicatorMin = Math.min(...ema9Values, ...ema21Values, ...vwapValues);
  const max = Math.max(...highs, indicatorMax);
  const min = Math.min(...lows, indicatorMin);
  const range = Math.max(1, max - min);
  const top = 10;
  const bottom = height - 10;
  const bodyWidth = Math.max(3, Math.min(8, width / Math.max(16, candles.length * 1.6)));

  const yOf = (value: number) => bottom - ((value - min) / range) * (bottom - top);

  const bodies: HeikinAshiBody[] = ha.map((row, index) => {
    const x = (index / Math.max(1, ha.length - 1)) * width;
    const openY = yOf(row.open);
    const closeY = yOf(row.close);
    const highY = yOf(row.high);
    const lowY = yOf(row.low);
    const bodyY = Math.min(openY, closeY);
    const bodyH = Math.max(2, Math.abs(openY - closeY));
    return {
      x: round(x, 1),
      width: round(bodyWidth, 1),
      wickHighY: round(highY, 1),
      wickLowY: round(lowY, 1),
      bodyY: round(bodyY, 1),
      bodyH: round(bodyH, 1),
      bullish: row.close >= row.open,
    };
  });

  return {
    bodies,
    ema9: buildLinePath(ema9Values, min, max, width, height),
    ema21: buildLinePath(ema21Values, min, max, width, height),
    vwapLine: buildLinePath(vwapValues, min, max, width, height),
  };
}

export function buildPhoenixCoach(
  signals: TimeframeSignal[],
  plan: PhoenixPlan,
  intel: MacroIntel,
  snapshot: CoinstoreSnapshot,
  mode25x: boolean
): PhoenixCoachCue[] {
  const tf1 = signals.find((signal) => signal.timeframe === "1m") || signals[0];
  const tf5 = signals.find((signal) => signal.timeframe === "5m") || signals[0];
  const spreadPct = snapshot.markPrice ? (snapshot.spread / snapshot.markPrice) * 100 : 0;
  const crowding = Math.abs(snapshot.fundingRate) * 100;

  const cues: PhoenixCoachCue[] = [];

  if (plan.primaryBias === "WAIT") {
    cues.push({
      key: "patience",
      label: "wait",
      detail: mode25x
        ? "25x mode is filtering this out. Let the market clean up before you commit ammo."
        : "The stack is mixed. No-trade is still a clean decision.",
      tone: "warn",
    });
  } else {
    cues.push({
      key: "bias",
      label: plan.primaryBias === "LONG" ? "long bias" : "short bias",
      detail: `${plan.setupName}. Work the entry zone first and avoid chasing outside ${plan.entryZone}.`,
      tone: plan.primaryBias === "LONG" ? "good" : "bad",
    });
  }

  cues.push({
    key: "fast-lane",
    label: "fast lane",
    detail: `${tf1.timeframe} says ${tf1.bias} with ${tf1.confidence}% confidence. ${tf1.reason}`,
    tone: tf1.bias === "LONG" ? "good" : tf1.bias === "SHORT" ? "bad" : "muted",
  });

  cues.push({
    key: "anchor",
    label: "anchor frame",
    detail: `${tf5.timeframe} is the anchor here: ${tf5.setupName}. ${tf5.regime} / ${tf5.trend}.`,
    tone: tf5.bias === "LONG" ? "good" : tf5.bias === "SHORT" ? "bad" : "warn",
  });

  cues.push({
    key: "friction",
    label: "execution friction",
    detail:
      spreadPct > (mode25x ? 0.02 : 0.03) || crowding > (mode25x ? 0.06 : 0.08)
        ? `Spread ${spreadPct.toFixed(3)}% and funding ${crowding.toFixed(4)}% mean execution friction is elevated. Trade smaller or pass.`
        : `Spread ${spreadPct.toFixed(3)}% and funding ${crowding.toFixed(4)}% are not the main blocker right now.`,
    tone: spreadPct > (mode25x ? 0.02 : 0.03) || crowding > (mode25x ? 0.06 : 0.08) ? "warn" : "good",
  });

  cues.push({
    key: "macro",
    label: "macro tone",
    detail: intel.headline,
    tone: intel.marketTone === "risk-on" ? "good" : intel.marketTone === "risk-off" ? "bad" : "muted",
  });

  cues.push({
    key: "kill-switch",
    label: "kill switch",
    detail: plan.killSwitch,
    tone: "warn",
  });

  return cues;
}
