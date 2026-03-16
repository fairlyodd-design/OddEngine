import React, { useEffect, useMemo, useState } from "react";
import {
  Bias,
  CoinstoreCandle,
  CoinstoreSnapshot,
  FALLBACK_SNAPSHOT,
  PhoenixPlan,
  TIMEFRAMES,
  TimeframeId,
  TimeframeSignal,
  buildHeikinAshiSvg,
  buildMacroIntel,
  buildPhoenixCoach,
  buildPhoenixPlan,
  evaluateTimeframe,
  loadCoinstoreKeys,
  loadPhoenixPrefs,
  saveCoinstoreKeys,
  savePhoenixPrefs,
  seedMockCandles,
} from "../lib/coinstoreFutures";
import {
  PhoenixPaperTrade,
  closePaperTrade,
  createPaperTrade,
  safeLoadPaperBook,
  safeSavePaperBook,
  summarizePaperBook,
  updateOpenTradeMark,
} from "../lib/phoenixPaperTrade";

const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.035)",
  borderRadius: 16,
  padding: 14,
};

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
  borderRadius: 12,
  padding: "10px 12px",
};

function toneStyle(tone: "good" | "warn" | "bad" | "muted") {
  if (tone === "good") return { background: "rgba(94,201,111,0.16)", borderColor: "rgba(94,201,111,0.28)" };
  if (tone === "bad") return { background: "rgba(255,111,97,0.16)", borderColor: "rgba(255,111,97,0.28)" };
  if (tone === "warn") return { background: "rgba(255,197,61,0.16)", borderColor: "rgba(255,197,61,0.28)" };
  return { background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)" };
}

function biasTone(bias: Bias) {
  return bias === "LONG" ? "good" : bias === "SHORT" ? "bad" : "warn";
}

function humanStatus(status: "idle" | "loading" | "live" | "fallback") {
  if (status === "live") return "Live public data";
  if (status === "loading") return "Loading";
  return "Fallback mode";
}

function num(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const adaptiveTwoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
  gap: 12,
};

const adaptiveStats: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
};

const adaptiveCards: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

export default function CoinstoreBTCUSDTFutures() {
  const [activeChart, setActiveChart] = useState<TimeframeId>("5m");
  const [status, setStatus] = useState<"idle" | "loading" | "live" | "fallback">("idle");
  const [snapshot, setSnapshot] = useState<CoinstoreSnapshot>(FALLBACK_SNAPSHOT);
  const [candlesByTf, setCandlesByTf] = useState<Record<TimeframeId, CoinstoreCandle[]>>({
    "1m": seedMockCandles(70650, "1m"),
    "3m": seedMockCandles(70660, "3m"),
    "5m": seedMockCandles(70670, "5m"),
    "15m": seedMockCandles(70680, "15m"),
  });
  const [contractId, setContractId] = useState<number | null>(null);
  const [keys, setKeys] = useState(loadCoinstoreKeys());
  const [prefs, setPrefs] = useState(loadPhoenixPrefs());
  const [paperTrades, setPaperTrades] = useState<PhoenixPaperTrade[]>([]);
  const [paperSize, setPaperSize] = useState("25");
  const [paperLeverage, setPaperLeverage] = useState("25");
  const [paperNote, setPaperNote] = useState("");

  useEffect(() => { saveCoinstoreKeys(keys); }, [keys]);
  useEffect(() => { savePhoenixPrefs(prefs); }, [prefs]);

  useEffect(() => {
    const loaded = safeLoadPaperBook();
    setPaperTrades(loaded.trades);
  }, []);

  useEffect(() => {
    const updated = paperTrades.map((trade) => updateOpenTradeMark(trade, snapshot.markPrice));
    setPaperTrades((current) => {
      const changed = current.length !== updated.length || current.some((trade, i) => trade.pnlUsd !== updated[i]?.pnlUsd || trade.pnlPct !== updated[i]?.pnlPct);
      return changed ? updated : current;
    });
  }, [snapshot.markPrice]);

  useEffect(() => {
    safeSavePaperBook({ trades: paperTrades });
  }, [paperTrades]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setStatus("loading");
      try {
        const configRes = await fetch("https://futures.coinstore.com/api/configs/public");
        const configJson = await configRes.json();
        const btc = configJson?.data?.contracts?.find((row: any) => row?.name === "BTCUSDT");
        const cid = Number(btc?.contractId || 100300034);
        if (!cancelled) setContractId(cid);

        const snapshotRes = await fetch(`https://futures.coinstore.com/api/v1/futureQuot/querySnapshot?contractId=${cid}`);
        const snapshotJson = await snapshotRes.json();
        const result = snapshotJson?.result || snapshotJson?.data?.result || {};
        const liveSnapshot: CoinstoreSnapshot = {
          markPrice: Number(result?.mp || FALLBACK_SNAPSHOT.markPrice),
          fundingRate: Number(result?.fr || FALLBACK_SNAPSHOT.fundingRate),
          bestBid: Number(result?.bids?.[0]?.[0] || FALLBACK_SNAPSHOT.bestBid),
          bestAsk: Number(result?.asks?.[0]?.[0] || FALLBACK_SNAPSHOT.bestAsk),
          spread: Math.max(0, Number(result?.asks?.[0]?.[0] || 0) - Number(result?.bids?.[0]?.[0] || 0)) || FALLBACK_SNAPSHOT.spread,
          indexPrice: Number(result?.ip || result?.mp || FALLBACK_SNAPSHOT.indexPrice),
          volume24h: Number(result?.tv || FALLBACK_SNAPSHOT.volume24h),
          turnover24h: Number(result?.tt || FALLBACK_SNAPSHOT.turnover24h),
        };

        const tfEntries = await Promise.all(
          TIMEFRAMES.map(async (tf) => {
            try {
              const res = await fetch(`https://futures.coinstore.com/api/v1/futureQuot/queryCandlestick?contractId=${cid}&range=${tf.range}&limit=96`);
              const json = await res.json();
              const rawLines = json?.data?.lines;
              const candles: CoinstoreCandle[] = Array.isArray(rawLines) && rawLines.length
                ? rawLines.map((entry: any[]) => ({
                    ts: Number(entry[0]),
                    open: Number(entry[1]),
                    high: Number(entry[2]),
                    low: Number(entry[3]),
                    close: Number(entry[4]),
                    volume: Number(entry[5]),
                  }))
                : seedMockCandles(Number(liveSnapshot.markPrice || 70650), tf.id);
              return [tf.id, candles] as const;
            } catch {
              return [tf.id, seedMockCandles(Number(liveSnapshot.markPrice || 70650), tf.id)] as const;
            }
          })
        );

        if (!cancelled) {
          setSnapshot(liveSnapshot);
          setCandlesByTf(Object.fromEntries(tfEntries) as Record<TimeframeId, CoinstoreCandle[]>);
          setStatus("live");
        }
      } catch {
        if (!cancelled) {
          setSnapshot(FALLBACK_SNAPSHOT);
          setCandlesByTf({
            "1m": seedMockCandles(70650, "1m"),
            "3m": seedMockCandles(70660, "3m"),
            "5m": seedMockCandles(70670, "5m"),
            "15m": seedMockCandles(70680, "15m"),
          });
          setStatus("fallback");
        }
      }
    }
    run();
    return () => { cancelled = true; };
  }, []);

  const timeframeSignals = useMemo<TimeframeSignal[]>(() => {
    return TIMEFRAMES.map((tf) => evaluateTimeframe(tf.id, candlesByTf[tf.id] ?? seedMockCandles(70650, tf.id), snapshot, prefs.mode25x));
  }, [candlesByTf, snapshot, prefs.mode25x]);

  const phoenixPlan = useMemo<PhoenixPlan>(() => buildPhoenixPlan(timeframeSignals, snapshot, prefs.mode25x), [timeframeSignals, snapshot, prefs.mode25x]);
  const macroIntel = useMemo(() => buildMacroIntel(timeframeSignals, snapshot, phoenixPlan, prefs.mode25x), [timeframeSignals, snapshot, phoenixPlan, prefs.mode25x]);
  const coachCues = useMemo(() => buildPhoenixCoach(timeframeSignals, phoenixPlan, macroIntel, snapshot, prefs.mode25x), [timeframeSignals, phoenixPlan, macroIntel, snapshot, prefs.mode25x]);
  const chartCandles = candlesByTf[activeChart] ?? seedMockCandles(70670, activeChart);
  const chartSvg = useMemo(() => buildHeikinAshiSvg(chartCandles, 780, 240), [chartCandles]);
  const lastClose = chartCandles.at(-1)?.close ?? snapshot.markPrice;
  const paperSummary = useMemo(() => summarizePaperBook({ trades: paperTrades }), [paperTrades]);

  function handlePaper(side: "LONG" | "SHORT") {
    const trade = createPaperTrade({
      side,
      setupName: phoenixPlan.setupName,
      timeframeFocus: activeChart,
      entry: snapshot.markPrice,
      stop: num(phoenixPlan.invalidation, snapshot.markPrice),
      targets: phoenixPlan.targets.map((value) => num(value, snapshot.markPrice)),
      sizeUsd: Math.max(1, num(paperSize, 25)),
      leverage: Math.max(1, num(paperLeverage, 25)),
      notes: paperNote || `${phoenixPlan.intelHeadline} / ${phoenixPlan.whyNow}`,
    });
    setPaperTrades((current) => [trade, ...current]);
    setPaperNote("");
  }

  function closeTrade(id: string, reason: string, overridePrice?: number) {
    setPaperTrades((current) =>
      current.map((trade) =>
        trade.id === id && trade.status === "open"
          ? closePaperTrade(trade, overridePrice ?? snapshot.markPrice, reason)
          : trade
      )
    );
  }

  return (
    <div className="stack">
      <div className="card softCard" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="small shellEyebrow">FairlyOdd Phoenix sniper</div>
            <div className="h">BTC/USDT Futures — Coinstore</div>
            <div className="sub">
              Heikin Ashi candles, indicator overlays, macro/news-style intel, paper validation, and Homie as a calm sniper coach.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ ...card, minWidth: 120 }}>
              <div className="small">Status</div>
              <b>{humanStatus(status)}</b>
            </div>
            <div style={{ ...card, minWidth: 120 }}>
              <div className="small">Phoenix score</div>
              <b>{phoenixPlan.phoenixScore}</b>
            </div>
            <div style={{ ...card, minWidth: 120 }}>
              <div className="small">Bias</div>
              <b>{phoenixPlan.primaryBias}</b>
            </div>
            <div style={{ ...card, minWidth: 120 }}>
              <div className="small">Paper net</div>
              <b>{paperSummary.netUsd >= 0 ? "+" : ""}{paperSummary.netUsd.toFixed(2)}</b>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label className="muted" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={prefs.mode25x} onChange={(e) => setPrefs({ mode25x: e.target.checked })} />
            Phoenix 25x risk compression
          </label>

          <span
            style={{
              borderRadius: 999,
              padding: "5px 8px",
              fontSize: 11,
              border: "1px solid rgba(255,255,255,0.08)",
              ...toneStyle(biasTone(phoenixPlan.primaryBias)),
            }}
          >
            {phoenixPlan.alignment}
          </span>
        </div>
      </div>

      <div style={adaptiveTwoCol}>
        <div className="stack">
          <div className="card softCard">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <div className="small shellEyebrow">Sniper alignment</div>
                <div className="h">1m / 3m / 5m / 15m stack</div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {TIMEFRAMES.map((tf) => (
                  <button key={tf.id} className={`tabBtn ${activeChart === tf.id ? "active" : ""}`} type="button" onClick={() => setActiveChart(tf.id)}>
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ ...adaptiveCards, marginTop: 12 }}>
              {timeframeSignals.map((signal) => (
                <div key={signal.timeframe} style={{ ...card, borderColor: toneStyle(biasTone(signal.bias)).borderColor, background: toneStyle(biasTone(signal.bias)).background }}>
                  <div className="small">{signal.timeframe}</div>
                  <b>{signal.bias}</b>
                  <div className="muted">{signal.setupName}</div>
                  <div className="small">{signal.confidence}% confidence</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              <svg viewBox="0 0 780 240" style={{ width: "100%", height: 240, borderRadius: 18 }} role="img" aria-label="BTCUSDT Phoenix sniper Heikin Ashi chart">
                <rect x="0" y="0" width="780" height="240" rx="18" fill="rgba(255,255,255,0.02)" />
                {[48, 96, 144, 192].map((y) => (
                  <line key={y} x1="0" y1={y} x2="780" y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 6" />
                ))}
                <path d={chartSvg.vwapLine} fill="none" stroke="rgba(110,231,255,0.6)" strokeWidth="2" strokeDasharray="6 5" />
                <path d={chartSvg.ema21} fill="none" stroke="rgba(168,85,247,0.85)" strokeWidth="2.4" />
                <path d={chartSvg.ema9} fill="none" stroke="rgba(245,158,11,0.95)" strokeWidth="2.6" />
                {chartSvg.bodies.map((body, index) => (
                  <g key={index}>
                    <line
                      x1={body.x}
                      x2={body.x}
                      y1={body.wickHighY}
                      y2={body.wickLowY}
                      stroke={body.bullish ? "rgba(94,201,111,0.95)" : "rgba(255,111,97,0.95)"}
                      strokeWidth="1.4"
                    />
                    <rect
                      x={body.x - body.width / 2}
                      y={body.bodyY}
                      width={body.width}
                      height={body.bodyH}
                      rx="1.5"
                      fill={body.bullish ? "rgba(94,201,111,0.92)" : "rgba(255,111,97,0.92)"}
                    />
                  </g>
                ))}
              </svg>
            </div>

            <div style={{ ...adaptiveStats, marginTop: 12 }}>
              <div style={card}><div className="small">Active chart</div><b>{activeChart}</b></div>
              <div style={card}><div className="small">Last</div><b>{lastClose.toLocaleString()}</b></div>
              <div style={card}><div className="small">Mark</div><b>{snapshot.markPrice.toLocaleString()}</b></div>
              <div style={card}><div className="small">Funding</div><b>{(snapshot.fundingRate * 100).toFixed(4)}%</b></div>
              <div style={card}><div className="small">Indicators</div><b>HA · EMA9/21 · VWAP</b></div>
            </div>
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">Execution guardrails</div>
            <div className="h">{phoenixPlan.setupName}</div>
            <p className="muted" style={{ marginTop: 8 }}>{phoenixPlan.whyNow}</p>

            <div style={{ ...adaptiveStats, marginTop: 12 }}>
              <div style={card}><div className="small">Entry zone</div><b>{phoenixPlan.entryZone}</b></div>
              <div style={card}><div className="small">Invalidation</div><b>{phoenixPlan.invalidation}</b></div>
              <div style={card}><div className="small">R multiple</div><b>{phoenixPlan.riskReward}</b></div>
              <div style={card}><div className="small">Target 1</div><b>{phoenixPlan.targets[0]}</b></div>
              <div style={card}><div className="small">Target 2</div><b>{phoenixPlan.targets[1]}</b></div>
              <div style={card}><div className="small">Target 3</div><b>{phoenixPlan.targets[2]}</b></div>
            </div>

            <div className="stack" style={{ marginTop: 12 }}>
              {phoenixPlan.executionNotes.map((note) => (
                <div style={row} key={note}>
                  <span className="muted">{note}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">Phoenix setup cards</div>
            <div style={{ ...adaptiveCards, marginTop: 12 }}>
              {phoenixPlan.setupCards.map((cardItem, index) => (
                <div key={`${cardItem.title}-${index}`} style={{ ...card, borderColor: toneStyle(cardItem.tone).borderColor, background: toneStyle(cardItem.tone).background }}>
                  <strong>{cardItem.title}</strong>
                  <div className="muted">{cardItem.subtitle}</div>
                  <p className="muted" style={{ marginTop: 8 }}>{cardItem.why}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card softCard">
            <div className="small shellEyebrow">Homie Phoenix coach</div>
            <div className="h">Calm sniper cues</div>
            <div className="sub" style={{ marginTop: 4 }}>
              Homie reacts like a patient coach: wait, too extended, good reclaim, do not force it, take partials.
            </div>
            <div className="stack" style={{ marginTop: 12 }}>
              {coachCues.map((cue) => (
                <div key={cue.key} style={{ ...row, borderColor: toneStyle(cue.tone).borderColor, background: toneStyle(cue.tone).background }}>
                  <div>
                    <strong style={{ textTransform: "capitalize" }}>{cue.label}</strong>
                    <div className="muted">{cue.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">Macro + news-style intel</div>
            <div className="h">{macroIntel.headline}</div>
            <p className="muted" style={{ marginTop: 8 }}>{macroIntel.summary}</p>

            <div style={{ ...adaptiveStats, marginTop: 12 }}>
              {macroIntel.scorecards.map((score) => (
                <div key={score.label} style={{ ...card, borderColor: toneStyle(score.tone).borderColor, background: toneStyle(score.tone).background }}>
                  <div className="small">{score.label}</div>
                  <b>{score.value}</b>
                </div>
              ))}
            </div>

            <div className="stack" style={{ marginTop: 12 }}>
              {macroIntel.bullets.map((bullet) => (
                <div style={row} key={bullet}>
                  <span className="muted">{bullet}</span>
                </div>
              ))}
            </div>

            <div className="stack" style={{ marginTop: 12 }}>
              {macroIntel.warnings.map((warning) => (
                <div style={{ ...row, borderColor: toneStyle("warn").borderColor, background: toneStyle("warn").background }} key={warning}>
                  <span className="muted">{warning}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">Paper trade launcher</div>
            <div className="h">Validate the setup</div>
            <div className="sub" style={{ marginTop: 4 }}>
              Sim the sniper before risking real ammo. Same entry zone, same stop, same target ladder.
            </div>

            <div style={{ ...adaptiveStats, marginTop: 12 }}>
              <div className="stack">
                <label className="small">Paper size (USD)</label>
                <input className="input" value={paperSize} onChange={(e) => setPaperSize(e.target.value)} />
              </div>
              <div className="stack">
                <label className="small">Leverage</label>
                <input className="input" value={paperLeverage} onChange={(e) => setPaperLeverage(e.target.value)} />
              </div>
            </div>

            <div className="stack" style={{ marginTop: 12 }}>
              <label className="small">Paper note</label>
              <textarea className="input" rows={3} value={paperNote} onChange={(e) => setPaperNote(e.target.value)} placeholder="Why this sim exists, what you want to test, what would invalidate your read..." />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <button className="tabBtn active" type="button" onClick={() => handlePaper("LONG")}>Paper LONG</button>
              <button className="tabBtn" type="button" onClick={() => handlePaper("SHORT")}>Paper SHORT</button>
            </div>
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">Paper journal</div>
            <div className="h">Scoreboard</div>

            <div style={{ ...adaptiveStats, marginTop: 12 }}>
              <div style={card}><div className="small">Open</div><b>{paperSummary.openCount}</b></div>
              <div style={card}><div className="small">Closed</div><b>{paperSummary.closedCount}</b></div>
              <div style={card}><div className="small">Net USD</div><b>{paperSummary.netUsd >= 0 ? "+" : ""}{paperSummary.netUsd.toFixed(2)}</b></div>
              <div style={card}><div className="small">Wins</div><b>{paperSummary.wins}</b></div>
              <div style={card}><div className="small">Losses</div><b>{paperSummary.losses}</b></div>
              <div style={card}><div className="small">Avg %</div><b>{paperSummary.avgPct >= 0 ? "+" : ""}{paperSummary.avgPct.toFixed(2)}%</b></div>
            </div>

            <div className="stack" style={{ marginTop: 12 }}>
              {paperTrades.length ? paperTrades.map((trade) => (
                <div style={row} key={trade.id}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{trade.side} · {trade.setupName}</strong>
                    <div className="muted">
                      {trade.timeframeFocus} · entry {trade.entry.toFixed(1)} · stop {trade.stop.toFixed(1)} · size ${trade.sizeUsd} · {trade.leverage}x
                    </div>
                    <div className="small">{trade.createdAt}</div>
                    {trade.notes ? <div className="muted" style={{ marginTop: 4 }}>{trade.notes}</div> : null}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    <span
                      style={{
                        borderRadius: 999,
                        padding: "5px 8px",
                        fontSize: 11,
                        border: "1px solid rgba(255,255,255,0.08)",
                        ...toneStyle(trade.status === "open" ? "warn" : trade.pnlUsd > 0 ? "good" : "bad"),
                      }}
                    >
                      {trade.status === "open"
                        ? `Open · ${trade.pnlUsd >= 0 ? "+" : ""}${trade.pnlUsd.toFixed(2)}`
                        : `${trade.closeReason || "Closed"} · ${trade.pnlUsd >= 0 ? "+" : ""}${trade.pnlUsd.toFixed(2)}`}
                    </span>

                    {trade.status === "open" ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button className="tabBtn" type="button" onClick={() => closeTrade(trade.id, "Market close")}>Close now</button>
                        <button className="tabBtn" type="button" onClick={() => closeTrade(trade.id, "TP1", trade.targets[0])}>TP1</button>
                        <button className="tabBtn" type="button" onClick={() => closeTrade(trade.id, "TP2", trade.targets[1])}>TP2</button>
                        <button className="tabBtn" type="button" onClick={() => closeTrade(trade.id, "Stopped", trade.stop)}>Stop</button>
                      </div>
                    ) : null}
                  </div>
                </div>
              )) : (
                <div style={row}>
                  <span className="muted">No paper trades yet. Launch a LONG or SHORT sim from the current Phoenix setup.</span>
                </div>
              )}
            </div>
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">Local API staging</div>
            <div className="h">Coinstore keys</div>
            <div className="sub" style={{ marginTop: 4 }}>
              Keep keys local only. This lane is for your machine, not the repo.
            </div>
            <div className="stack" style={{ marginTop: 12 }}>
              <input className="input" placeholder="Coinstore API key (local only)" value={keys.apiKey} onChange={(e) => setKeys((current) => ({ ...current, apiKey: e.target.value }))} />
              <input className="input" type="password" placeholder="Coinstore API secret (local only)" value={keys.apiSecret} onChange={(e) => setKeys((current) => ({ ...current, apiSecret: e.target.value }))} />
              <textarea className="input" rows={3} placeholder="Local note: IP bind, paper first, leverage rules..." value={keys.note} onChange={(e) => setKeys((current) => ({ ...current, note: e.target.value }))} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
