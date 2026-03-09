export type MockContract = {
  id: string;
  symbol: string;
  side: "call" | "put";
  strike: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  oi: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  probability: number;
  spreadPct: number;
  score: number;
};

export const MOCK_EXPIRATIONS = ["Mar 13 '26", "Mar 20 '26", "Mar 27 '26", "Apr 17 '26"];

function round(n: number, digits = 2) {
  return Number(n.toFixed(digits));
}

function expirationBoost(expiration: string) {
  if (expiration.includes("Mar 13")) return 1;
  if (expiration.includes("Mar 20")) return 1.08;
  if (expiration.includes("Mar 27")) return 1.16;
  return 1.28;
}

export function generateMockChain(symbol: string, underlying: number, expiration: string, bias: "bullish" | "bearish" | "neutral") {
  const baseStrike = Math.round(underlying / 2) * 2;
  const boost = expirationBoost(expiration);
  const offsets = [-6, -4, -2, 0, 2, 4, 6];

  const contracts: MockContract[] = [];

  offsets.forEach((offset, idx) => {
    const strike = baseStrike + offset;
    const distance = Math.abs(offset);
    const callDelta = round(Math.max(0.18, 0.56 - distance * 0.045), 2);
    const putDelta = round(-Math.max(0.18, 0.54 - distance * 0.043), 2);
    const ivBase = 22 + distance * 0.75 + (symbol === "HIMS" ? 18 : 0) + (symbol === "TSLA" ? 8 : 0);
    const askCall = round((Math.max(1.1, (underlying - strike + 6.5) * 0.55) + idx * 0.18) * boost, 2);
    const askPut = round((Math.max(1.05, (strike - underlying + 6.3) * 0.52) + (offsets.length - idx) * 0.14) * boost, 2);

    const makeContract = (side: "call" | "put", ask: number, delta: number): MockContract => {
      const bid = round(Math.max(0.05, ask - 0.18 - distance * 0.01), 2);
      const spreadPct = round(((ask - bid) / Math.max(ask, 0.01)) * 100, 1);
      const gamma = round(Math.max(0.018, 0.09 - distance * 0.007 + (side === "call" && bias === "bullish" ? 0.01 : 0) + (side === "put" && bias === "bearish" ? 0.01 : 0)), 3);
      const theta = round(-(0.06 + distance * 0.015 + (boost - 1) * 0.09), 3);
      const vega = round(0.04 + distance * 0.007 + (ivBase > 35 ? 0.03 : 0), 3);
      const volume = Math.round(900 + (7 - distance) * 240 + (side === "call" && bias === "bullish" ? 250 : 0) + (side === "put" && bias === "bearish" ? 250 : 0));
      const oi = Math.round(2400 + (7 - distance) * 520 + (idx % 2 === 0 ? 180 : 0));
      const probability = Math.max(24, Math.min(76, Math.round(50 + delta * 18 - distance * 1.4 + (side === "call" && bias === "bullish" ? 6 : 0) + (side === "put" && bias === "bearish" ? 6 : 0))));
      const score = Math.round(
        probability * 0.48 +
        Math.min(oi / 100, 80) * 0.2 +
        Math.min(volume / 100, 40) * 0.17 +
        Math.max(0, 20 - spreadPct) * 0.15
      );

      return {
        id: `${symbol}-${expiration}-${side}-${strike}`,
        symbol,
        side,
        strike,
        bid,
        ask,
        last: round((ask + bid) / 2, 2),
        volume,
        oi,
        iv: round(ivBase + (side === "put" ? 1.4 : 0), 1),
        delta,
        gamma,
        theta,
        vega,
        probability,
        spreadPct,
        score,
      };
    };

    contracts.push(makeContract("call", askCall, callDelta));
    contracts.push(makeContract("put", askPut, putDelta));
  });

  return contracts.sort((a, b) => b.score - a.score);
}
