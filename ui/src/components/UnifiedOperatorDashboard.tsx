import React, { useEffect, useMemo, useRef, useState } from "react";
import { getPanelMeta } from "../lib/brain";
import { buildUnifiedOperatorSnapshot, type UnifiedOperatorItem, type UnifiedOperatorSnapshot, type UnifiedOperatorView } from "../lib/unifiedOperatorDashboard";
import { buildGodModeDecisionSnapshot, loadOperatorMode, saveOperatorMode, type DecisionCandidate, type DecisionSnapshot, type OperatorMode } from "../lib/godModeDecisionEngine";
import { executeDecisionCandidate, listExecutionLog } from "../lib/actionExecutor";
import { buildOpportunityRadarSnapshot, type OpportunityBucket, type OpportunityRadarItem, type OpportunityRadarSnapshot } from "../lib/opportunityRadar";
import { buildWorkflowChainSnapshot, runWorkflowChain, type WorkflowChain, type WorkflowChainSnapshot } from "../lib/autopilotWorkflowChains";
import { buildMissionControlClaritySnapshot, type MissionControlClaritySnapshot } from "../lib/missionControlClarity";
import { buildIncomeExecutionLoopSnapshot, runIncomeExecutionLoop, type IncomeExecutionLoopSnapshot } from "../lib/incomeExecutionLoop";
import SystemTruthPanel from "./SystemTruthPanel";
import { buildHomieExecutiveSnapshot } from "../lib/homieExecutive";
import { buildLifeOSLoopSnapshot, loadLifeAutonomyLevel, saveLifeAutonomyLevel, runLifeOSAutonomousTick, type LifeAutonomyLevel, type LifeOSLoopSnapshot, LIFE_OS_LOOP_EVENT } from "../lib/lifeOSLoop";
import { buildConnectorClosureSnapshot, runConnectorExecutionClosure, type ConnectorClosureSnapshot, CONNECTOR_CLOSURE_EVENT } from "../lib/connectorExecutionClosure";

const VIEWS: Array<{ id: UnifiedOperatorView; label: string }> = [
  { id: "today", label: "Today" },
  { id: "now", label: "Now" },
  { id: "queued", label: "Queued" },
  { id: "blocked", label: "Blocked" },
];

const MODES: OperatorMode[] = ["manual", "assisted", "autopilot"];
const AUTONOMY_LEVELS: Array<{ id: LifeAutonomyLevel; label: string }> = [
  { id: "manual", label: "Manual" },
  { id: "assisted", label: "Assisted" },
  { id: "semiAuto", label: "Semi-auto" },
  { id: "fullAuto", label: "Full auto 🔥" },
];

const RADAR_BUCKETS: Array<{ id: OpportunityBucket; label: string }> = [
  { id: "doNow", label: "Do now" },
  { id: "watch", label: "Watch" },
  { id: "later", label: "Later" },
  { id: "ignore", label: "Ignore" },
];

export default function UnifiedOperatorDashboard({ activePanelId, onNavigate, onOpenPanel }: { activePanelId: string; onNavigate?: (id: string) => void; onOpenPanel?: (id: string) => void; }) {
  const [view, setView] = useState<UnifiedOperatorView>("today");
  const [snapshot, setSnapshot] = useState<UnifiedOperatorSnapshot | null>(null);
  const [decision, setDecision] = useState<DecisionSnapshot | null>(null);
  const [radar, setRadar] = useState<OpportunityRadarSnapshot | null>(null);
  const [chains, setChains] = useState<WorkflowChainSnapshot | null>(null);
  const [clarity, setClarity] = useState<MissionControlClaritySnapshot | null>(null);
  const [incomeLoop, setIncomeLoop] = useState<IncomeExecutionLoopSnapshot | null>(null);
  const [lifeLoop, setLifeLoop] = useState<LifeOSLoopSnapshot | null>(null);
  const [closure, setClosure] = useState<ConnectorClosureSnapshot | null>(null);
  const [radarBucket, setRadarBucket] = useState<OpportunityBucket>("doNow");
  const [mode, setMode] = useState<OperatorMode>(() => loadOperatorMode());
  const [autonomy, setAutonomy] = useState<LifeAutonomyLevel>(() => loadLifeAutonomyLevel());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [executionNote, setExecutionNote] = useState("");
  const autopilotRanRef = useRef("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [next, nextDecision, nextRadar, nextChains, nextClarity] = await Promise.all([
        buildUnifiedOperatorSnapshot(activePanelId || "Brain"),
        buildGodModeDecisionSnapshot(activePanelId || "Brain"),
        buildOpportunityRadarSnapshot(activePanelId || "Brain"),
        buildWorkflowChainSnapshot(activePanelId || "Brain"),
        buildMissionControlClaritySnapshot(activePanelId || "Brain"),
      ]);
      setSnapshot(next);
      setDecision(nextDecision);
      setRadar(nextRadar);
      setChains(nextChains);
      setClarity(nextClarity);
      setIncomeLoop(buildIncomeExecutionLoopSnapshot(nextDecision.bestNow || nextDecision.bestToday || null));
      setLifeLoop(buildLifeOSLoopSnapshot(activePanelId || "Brain"));
      setClosure(buildConnectorClosureSnapshot());
    } catch (err: any) {
      setError(String(err?.message || err || "Unable to build operator dashboard."));
    } finally {
      setLoading(false);
    }
  }

  async function runCandidate(candidate: DecisionCandidate) {
    const result = await executeDecisionCandidate(candidate, mode);
    setExecutionNote(result.message);
    if (candidate.action.panelId) onNavigate?.(candidate.action.panelId);
    if (candidate.action.type === "review-output") onNavigate?.("Books");
    if (candidate.action.type === "load-preset") onNavigate?.("Brain");
    void refresh();
  }

  async function runIncome(candidate: DecisionCandidate) {
    const result = await runIncomeExecutionLoop(candidate, mode);
    setExecutionNote(result.message);
    if (candidate.action.panelId) onNavigate?.(candidate.action.panelId);
    void refresh();
  }

  useEffect(() => {
    saveOperatorMode(mode);
  }, [mode]);

  useEffect(() => {
    saveLifeAutonomyLevel(autonomy);
  }, [autonomy]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => { void refresh(); }, 15000);
    const onFocus = () => { void refresh(); };
    const onLife = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener(LIFE_OS_LOOP_EVENT, onLife);
    window.addEventListener(CONNECTOR_CLOSURE_EVENT, onLife);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(LIFE_OS_LOOP_EVENT, onLife);
      window.removeEventListener(CONNECTOR_CLOSURE_EVENT, onLife);
    };
  }, [activePanelId]);

  useEffect(() => {
    if (mode !== "autopilot" || !decision?.bestNow?.action.lowRisk) return;
    const stamp = `${decision.bestNow.id}:${Math.floor(decision.generatedAt / 15000)}`;
    if (autopilotRanRef.current === stamp) return;
    autopilotRanRef.current = stamp;
    void runCandidate(decision.bestNow);
  }, [mode, decision?.generatedAt, decision?.bestNow?.id]);

  useEffect(() => {
    if ((autonomy !== "semiAuto" && autonomy !== "fullAuto") || !decision?.bestNow?.action.lowRisk) return;
    const stamp = `life:${autonomy}:${decision.bestNow.id}:${Math.floor(decision.generatedAt / 15000)}`;
    if (autopilotRanRef.current === stamp) return;
    autopilotRanRef.current = stamp;
    void runLifeOSAutonomousTick(decision.bestNow, autonomy).then((result) => {
      setExecutionNote(result.message);
      void refresh();
    });
  }, [autonomy, decision?.generatedAt, decision?.bestNow?.id]);

  const items = useMemo(() => snapshot?.views[view] || [], [snapshot, view]);
  const radarItems = useMemo(() => radar?.buckets[radarBucket] || [], [radar, radarBucket]);
  const executionLog = useMemo(() => listExecutionLog().slice(0, 4), [decision?.generatedAt, executionNote, autonomy]);
  const homieExecutive = useMemo(() => buildHomieExecutiveSnapshot(activePanelId || "Brain"), [activePanelId, decision?.generatedAt, executionNote, autonomy]);

  async function runChain(chain: WorkflowChain) {
    const result = await runWorkflowChain(chain, mode);
    setExecutionNote(result.message);
    if (chain.candidate?.panelId) onNavigate?.(chain.candidate.panelId);
    void refresh();
  }

  async function runClosure() {
    const result = await runConnectorExecutionClosure();
    setExecutionNote(result.message);
    void refresh();
  }

  return (
    <div style={shell}>
      <div style={heroCard}>
        <div style={topRow}>
          <div>
            <div style={eyebrow}>God Mode • Unified operator dashboard</div>
            <div style={headline}>{clarity?.headline || decision?.headline || snapshot?.headline || "Building operator picture..."}</div>
            <div style={subline}>{clarity?.explanation || decision?.explanation || radar?.headline || snapshot?.nowLine || "Pulling Money, Studio, Trading, Homie, and Mission Control into one board."}</div>
          </div>
          <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
            <div style={modeRow}>
              {MODES.map((entry) => (
                <button key={entry} className={`tabBtn ${mode === entry ? "active" : ""}`.trim()} onClick={() => setMode(entry)}>
                  {entry === "manual" ? "Manual" : entry === "assisted" ? "Assisted" : "Autopilot 🔥"}
                </button>
              ))}
            </div>
            <div style={modeRow}>
              {AUTONOMY_LEVELS.map((entry) => (
                <button key={entry.id} className={`tabBtn ${autonomy === entry.id ? "active" : ""}`.trim()} onClick={() => setAutonomy(entry.id)}>
                  {entry.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button className="tabBtn active" onClick={() => decision?.bestNow && void runCandidate(decision.bestNow)}>Run best move</button>
              <button className="tabBtn" onClick={() => decision?.bestNow && void runIncome(decision.bestNow)}>Run income loop</button>
              <button className="tabBtn" onClick={() => onOpenPanel?.("Homie")}>Open Homie</button>
              <button className="tabBtn" onClick={() => void runClosure()}>Verify connectors</button>
              <button className="tabBtn" onClick={() => void refresh()}>{loading ? "Refreshing..." : "Refresh"}</button>
            </div>
          </div>
        </div>

        <div style={statsRow}>
          <StatCard label="Quick cash" value={decision?.stats.quickCash ?? "—"} detail="Under 10 min" />
          <StatCard label="Active" value={decision?.stats.active ?? "—"} detail="Auto running" />
          <StatCard label="Queued" value={decision?.stats.queued ?? snapshot?.stats.queued ?? "—"} detail="Operator actions" />
          <StatCard label="Blocked" value={decision?.stats.blocked ?? snapshot?.stats.blocked ?? "—"} detail="Needs attention" />
          <StatCard label="Money" value={decision ? `$${decision.stats.earnedUsd.toFixed(2)}` : snapshot ? `$${snapshot.stats.earnedUsd.toFixed(2)}` : "—"} detail="Captured outcomes" />
        </div>

        <div style={bestMoveRow}>
          <div style={bestMoveCard}>
            <div style={eyebrow}>Best move now</div>
            {clarity?.bestMove ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{clarity.bestMove.title}</div>
                <div style={{ color: "rgba(227,240,255,.78)", lineHeight: 1.5 }}>{clarity.bestMove.body}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={pill}>{clarity.bestMove.source}</span>
                  <span style={pill}>{clarity.bestMove.etaLabel}</span>
                  <span style={pill}>Score {clarity.bestMove.score}</span>
                </div>
                {decision?.bestNow ? <DecisionItemCard item={decision.bestNow} onNavigate={onNavigate} onRun={runCandidate} compact /> : null}
              </div>
            ) : decision?.bestNow ? <DecisionItemCard item={decision.bestNow} onNavigate={onNavigate} onRun={runCandidate} compact /> : <EmptyState text="No ranked move yet. Seed data in Money, Studio, or Trading and refresh." />}
          </div>
          <div style={homieCard}>
            <div style={eyebrow}>God Mode Homie</div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{homieExecutive.headline || snapshot?.homieHeadline || "Homie is pulling signal..."}</div>
            <div style={{ marginTop: 8, color: "rgba(227,240,255,.78)", lineHeight: 1.5 }}>{homieExecutive.explanation || radar?.operatorLine || decision?.operatorLine || snapshot?.homieBrief || "Operator layer is joining context from the active panel, money queue, and mission stack."}</div>
            {executionNote ? <div style={pillWide}>{executionNote}</div> : null}
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="tabBtn" onClick={() => onNavigate?.("Homie")}>Go to Homie</button>
              <button className="tabBtn" onClick={() => onNavigate?.("Brain")}>Go to Brain</button>
              <button className="tabBtn" onClick={() => onOpenPanel?.("Money")}>Open Money</button>
            </div>
          </div>
        </div>
      </div>

      <SystemTruthPanel activePanelId={activePanelId} />

      <div style={decisionGrid}>
        <div style={bucketCard}>
          <div style={eyebrow}>21a • True autonomous operator</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>{lifeLoop?.headline || "Autonomous life loop standing by..."}</div>
          <div style={{ marginTop: 8, color: "rgba(227,240,255,.76)", lineHeight: 1.5 }}>{lifeLoop?.explanation || "Homie watches system runs, blocked items, connectors, and outputs so the OS works with you, not just in front of you."}</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={pill}>Autonomy {lifeLoop?.autonomy || autonomy}</span>
            <span style={pill}>Running {lifeLoop?.stats.running ?? 0}</span>
            <span style={pill}>Ready outputs {lifeLoop?.stats.artifactsReady ?? 0}</span>
            <span style={pill}>Receipts today {lifeLoop?.stats.receiptsToday ?? 0}</span>
          </div>
          <div style={{ marginTop: 10, color: "rgba(227,240,255,.64)", fontSize: 12 }}>{lifeLoop?.watcherSummary || "Watching the whole OS for the next safe move."}</div>
        </div>
        <div style={bucketCard}>
          <div style={eyebrow}>21b • Connector closure</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>{closure?.headline || "Connector proof loop standing by..."}</div>
          <div style={{ marginTop: 8, color: "rgba(227,240,255,.76)", lineHeight: 1.5 }}>{closure?.explanation || "Verify that bridges, outputs, and publish lanes are actually connected, not just assumed."}</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={pill}>Connected {closure?.stats.connected ?? 0}</span>
            <span style={pill}>Failed {closure?.stats.failed ?? 0}</span>
            <span style={pill}>Pending {closure?.stats.pending ?? 0}</span>
          </div>
        </div>
        <div style={bucketCard}>
          <div style={eyebrow}>Mission clarity</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>{clarity?.headline || "Compressing priorities..."}</div>
          <div style={{ marginTop: 8, color: "rgba(227,240,255,.76)", lineHeight: 1.5 }}>{clarity?.explanation || "Reducing noise so Mission Control can show one clear move and a few high-value backups."}</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={pill}>Now {clarity?.stats.now ?? 0}</span>
            <span style={pill}>Blocked {clarity?.stats.blocked ?? 0}</span>
            <span style={pill}>Hidden {clarity?.hiddenCount ?? 0}</span>
            <span style={pill}>Connector fails {clarity?.stats.connectorsFailing ?? 0}</span>
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {(clarity?.supportMoves || []).slice(0, 3).map((item) => (
              <button key={item.id} className="tabBtn" style={{ justifyContent: "space-between", textAlign: "left" }} onClick={() => onNavigate?.(item.panelId)}>
                <span>{item.title}</span><span style={{ opacity: .7 }}>{item.etaLabel}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={bucketCard}>
          <div style={eyebrow}>Income execution loop</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>{incomeLoop?.headline || "Preparing execution loop..."}</div>
          <div style={{ marginTop: 8, color: "rgba(227,240,255,.76)", lineHeight: 1.5 }}>{incomeLoop?.explanation || "This lane verifies, runs, and proves the next money move."}</div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {(incomeLoop?.steps || []).map((step) => (
              <div key={step.id} style={{ display: "grid", gap: 2, padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{step.label}</strong><span style={{ opacity: .75 }}>{step.state}</span></div>
                <div style={{ color: "rgba(227,240,255,.72)", fontSize: 13 }}>{step.detail}</div>
              </div>
            ))}
          </div>
        </div>
        <DecisionBucket title="Today plan" eyebrow="Best today" item={decision?.bestToday || null} onNavigate={onNavigate} onRun={runCandidate} />
        <DecisionBucket title="Quick cash" eyebrow="Under 10 minutes" item={decision?.views.quickCash?.[0] || null} onNavigate={onNavigate} onRun={runCandidate} />
        <DecisionBucket title="Blocked" eyebrow="Needs input" item={decision?.fallback || null} onNavigate={onNavigate} onRun={runCandidate} />
        <DecisionBucket title="Passive" eyebrow="Scale / preserve" item={decision?.passive || null} onNavigate={onNavigate} onRun={runCandidate} />
      </div>

      <div style={radarHeroGrid}>
        <div style={bucketCard}>
          <div style={eyebrow}>Opportunity Radar</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>{radar?.headline || "Scanning predictive lanes..."}</div>
          <div style={{ marginTop: 8, color: "rgba(227,240,255,.76)", lineHeight: 1.5 }}>{radar?.operatorLine || "Ranking what is likely to pay off next across Money, Studio, Trading, and Mission Control."}</div>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {radar?.fastestCashLane ? <RadarItemCard item={radar.fastestCashLane} onNavigate={onNavigate} /> : <EmptyState text="No predictive lane yet." />}
          </div>
        </div>
        <div style={radarMiniGrid}>
          <StatCard label="Do now" value={radar?.stats.doNow ?? "—"} detail="Highest predicted payoff" />
          <StatCard label="Watch" value={radar?.stats.watch ?? "—"} detail="Heating up" />
          <StatCard label="Later" value={radar?.stats.later ?? "—"} detail="Park for later" />
          <StatCard label="Avg cash ETA" value={radar ? labelRadarTime(radar.stats.avgTimeToCashMinutes) : "—"} detail="Across live lanes" />
        </div>
      </div>

      <div style={mainCard}>
        <div style={tabRow}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {RADAR_BUCKETS.map((entry) => (
              <button key={entry.id} className={`tabBtn ${radarBucket === entry.id ? "active" : ""}`.trim()} onClick={() => setRadarBucket(entry.id)}>
                {entry.label}
              </button>
            ))}
          </div>
          <div style={{ color: "rgba(227,240,255,.68)", fontSize: 12 }}>
            Fastest lane: <b>{radar?.fastestCashLane?.timeToCashLabel || "—"}</b> • Heating up: <b>{radar?.heatingUp?.title || "—"}</b>
          </div>
        </div>
        {!error && !loading && radarItems.length === 0 ? <EmptyState text={`No ${radarBucket} opportunities ranked yet.`} /> : null}
        <div style={{ display: "grid", gap: 10 }}>
          {radarItems.map((item) => <RadarItemCard key={item.id} item={item} onNavigate={onNavigate} />)}
        </div>
      </div>

      <div style={domainGrid}>
        {(snapshot?.domainCards || []).map((card) => (
          <button key={card.domain} onClick={() => onNavigate?.(card.panelId)} style={domainCardButton}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>{card.title}</div>
              <div style={pill}>{card.countLabel}</div>
            </div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: .9 }}>{card.status}</div>
            <div style={{ marginTop: 8, color: "rgba(227,240,255,.72)", lineHeight: 1.45 }}>{card.note}</div>
          </button>
        ))}
      </div>

      <div style={mainCard}>
        <div style={tabRow}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {VIEWS.map((entry) => (
              <button key={entry.id} className={`tabBtn ${view === entry.id ? "active" : ""}`.trim()} onClick={() => setView(entry.id)}>
                {entry.label}
              </button>
            ))}
          </div>
          <div style={{ color: "rgba(227,240,255,.68)", fontSize: 12 }}>
            Creative backend: <b>{snapshot?.backend.creativeStatus || "—"}</b> • Analytics: <b>{snapshot?.backend.analyticsStatus || "—"}</b>
          </div>
        </div>

        {error ? <div style={errorCard}>{error}</div> : null}
        {!error && loading && !snapshot ? <div style={loadingCard}>Building God Mode dashboard...</div> : null}
        {!error && !loading && items.length === 0 ? <EmptyState text={`No ${view} items yet.`} /> : null}

        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item) => <OperatorItemCard key={item.id} item={item} onNavigate={onNavigate} />)}
        </div>
      </div>

      <div style={mainCard}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={eyebrow}>True autopilot workflow chains</div>
            <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>{chains?.headline || "Chaining detect → queue → execute → learn"}</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatCard label="Ready" value={chains?.stats.ready ?? "—"} detail="Low-risk chains" />
            <StatCard label="Blocked" value={chains?.stats.blocked ?? "—"} detail="Need input" />
            <StatCard label="Earned" value={chains ? `$${chains.stats.earnedUsd.toFixed(2)}` : "—"} detail="Captured loop" />
          </div>
        </div>
        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {chains?.chains?.length ? chains.chains.map((chain) => (
            <div key={chain.id} style={itemCard}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{chain.title}</div>
                  <div style={{ color: "rgba(227,240,255,.72)", marginTop: 4 }}>{chain.summary}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={chain.status === "blocked" ? blockedPill : donePill}>{chain.status}</span>
                  <span style={pill}>{chain.etaMinutes} min</span>
                  <button className="tabBtn active" disabled={!chain.candidate} onClick={() => void runChain(chain)}>{mode === "manual" ? "Queue chain" : "Run chain"}</button>
                </div>
              </div>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                {chain.steps.map((step) => <div key={step.id} style={miniCard}><div style={{ fontSize: 12, opacity: .7 }}>{step.label}</div><div style={{ fontWeight: 800, marginTop: 4 }}>{step.state}</div><div style={{ marginTop: 4, color: "rgba(227,240,255,.7)", fontSize: 12, lineHeight: 1.4 }}>{step.detail}</div></div>)}
              </div>
            </div>
          )) : <EmptyState text="No workflow chains yet." />}
        </div>
      </div>

      <div style={mainCard}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={eyebrow}>What Homie did while you were away</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Life feed + connector proofs</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="tabBtn" onClick={() => void runClosure()}>Run proof loop</button>
            <button className="tabBtn" onClick={() => decision?.bestNow && void runLifeOSAutonomousTick(decision.bestNow, autonomy).then((result) => { setExecutionNote(result.message); void refresh(); })}>Run life tick</button>
          </div>
        </div>
        <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <div style={bucketCard}>
            <div style={eyebrow}>Life feed</div>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {(lifeLoop?.recent || []).length ? lifeLoop?.recent.map((entry) => (
                <div key={entry.id} style={miniCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{entry.title}</strong><span style={{ opacity: .7 }}>{entry.status}</span></div>
                  <div style={{ marginTop: 6, color: "rgba(227,240,255,.72)", fontSize: 12, lineHeight: 1.45 }}>{entry.body}</div>
                </div>
              )) : <EmptyState text="No life-feed actions recorded yet." />}
            </div>
          </div>
          <div style={bucketCard}>
            <div style={eyebrow}>Connector closure recents</div>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {(closure?.recent || []).length ? closure?.recent.map((entry) => (
                <div key={entry.id} style={miniCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{entry.label}</strong><span style={{ opacity: .7 }}>{entry.result}</span></div>
                  <div style={{ marginTop: 6, color: "rgba(227,240,255,.72)", fontSize: 12, lineHeight: 1.45 }}>{entry.detail}</div>
                </div>
              )) : <EmptyState text="No connector proof runs yet." />}
            </div>
          </div>
        </div>
      </div>

      <div style={mainCard}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={eyebrow}>Auto running</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Operator execution log</div>
          </div>
          <div style={{ color: "rgba(227,240,255,.68)", fontSize: 12 }}>Mode: <b>{mode}</b></div>
        </div>
        {executionLog.length === 0 ? <EmptyState text="No executions logged yet." /> : (
          <div style={{ display: "grid", gap: 10 }}>
            {executionLog.map((entry) => (
              <div key={entry.id} style={itemCard}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800 }}>{entry.title}</div>
                  <div style={entry.status === "error" ? blockedPill : entry.status === "done" ? donePill : queuedPill}>{entry.status}</div>
                </div>
                <div style={{ marginTop: 6, color: "rgba(227,240,255,.72)" }}>{entry.note || `Ran in ${entry.mode} mode.`}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DecisionBucket({ title, eyebrow: brow, item, onNavigate, onRun }: { title: string; eyebrow: string; item: DecisionCandidate | null; onNavigate?: (id: string) => void; onRun: (item: DecisionCandidate) => void; }) {
  return (
    <div style={bucketCard}>
      <div style={eyebrow}>{brow}</div>
      <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>{title}</div>
      <div style={{ marginTop: 10 }}>
        {item ? <DecisionItemCard item={item} onNavigate={onNavigate} onRun={onRun} compact /> : <EmptyState text="Nothing ranked here yet." />}
      </div>
    </div>
  );
}

function DecisionItemCard({ item, onNavigate, onRun, compact = false }: { item: DecisionCandidate; onNavigate?: (id: string) => void; onRun: (item: DecisionCandidate) => void; compact?: boolean }) {
  const meta = getPanelMeta(item.panelId);
  const stateStyle = item.state === "blocked"
    ? blockedPill
    : item.state === "active"
    ? activePill
    : item.state === "done"
    ? donePill
    : queuedPill;

  return (
    <div style={{ ...itemCard, padding: compact ? 12 : 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={eyebrow}>{item.kicker}</div>
          <div style={{ fontSize: compact ? 17 : 18, fontWeight: 900, marginTop: 4 }}>{item.title}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {item.amountLabel ? <div style={pill}>{item.amountLabel}</div> : null}
          <div style={stateStyle}>{item.state}</div>
        </div>
      </div>
      <div style={{ marginTop: 8, color: "rgba(227,240,255,.76)", lineHeight: 1.48 }}>{item.body}</div>
      <div style={{ marginTop: 10, fontSize: 12, color: "rgba(227,240,255,.62)" }}>
        {meta.icon} {meta.title} • score {item.score} • ETA {item.etaMin}m
      </div>
      <div style={metricRow}>
        <MiniMetric label="Profit" value={item.profitPotential} />
        <MiniMetric label="Speed" value={item.speedToCash} />
        <MiniMetric label="Effort" value={100 - item.effortRequired} />
        <MiniMetric label="Win odds" value={item.successProbability} />
      </div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "rgba(227,240,255,.62)" }}>
          {item.blockedReason || "Ready for God Mode routing."}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="tabBtn" onClick={() => onNavigate?.(item.panelId)}>Open</button>
          <button className="tabBtn active" onClick={() => void onRun(item)}>{item.action.lowRisk ? "Execute" : "Route"}</button>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div style={miniMetric}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "rgba(227,240,255,.56)" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800 }}>{Math.round(value)}</div>
    </div>
  );
}

function labelRadarTime(minutes: number) {
  if (!minutes) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
  const days = hours / 24;
  return `${days.toFixed(days >= 10 ? 0 : 1)}d`;
}

function RadarItemCard({ item, onNavigate }: { item: OpportunityRadarItem; onNavigate?: (id: string) => void }) {
  const meta = getPanelMeta(item.panelId);
  const bucketStyle = item.bucket === "doNow"
    ? activePill
    : item.bucket === "watch"
    ? pill
    : item.bucket === "later"
    ? queuedPill
    : blockedPill;
  return (
    <div style={itemCard}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={eyebrow}>Predictive radar • {meta.title}</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>{item.title}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
          <div style={pill}>{item.timeToCashLabel} to cash</div>
          <div style={bucketStyle}>{item.bucket}</div>
        </div>
      </div>
      <div style={{ marginTop: 8, color: "rgba(227,240,255,.76)", lineHeight: 1.48 }}>{item.body}</div>
      <div style={{ marginTop: 8, color: "rgba(227,240,255,.64)", fontSize: 12 }}>{item.note}</div>
      <div style={metricRow}>
        <MiniMetric label="Predict" value={item.predictiveScore} />
        <MiniMetric label="Momentum" value={item.momentum} />
        <MiniMetric label="Urgency" value={item.urgency} />
        <MiniMetric label="Energy" value={100 - item.energyCost} />
      </div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "rgba(227,240,255,.62)" }}>{meta.icon} {meta.title} • {item.actionLabel}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="tabBtn" onClick={() => onNavigate?.(item.panelId)}>{item.actionLabel}</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div style={statCard}>
      <div style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(227,240,255,.62)" }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900 }}>{value}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: "rgba(227,240,255,.64)" }}>{detail}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={loadingCard}>{text}</div>;
}

function OperatorItemCard({ item, onNavigate, compact = false }: { item: UnifiedOperatorItem; onNavigate?: (id: string) => void; compact?: boolean }) {
  const meta = getPanelMeta(item.panelId);
  const stateStyle = item.state === "blocked"
    ? blockedPill
    : item.state === "active"
    ? activePill
    : item.state === "done"
    ? donePill
    : queuedPill;

  return (
    <div style={{ ...itemCard, padding: compact ? 12 : 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={eyebrow}>{item.kicker || `${meta.title} • ${item.source || "operator"}`}</div>
          <div style={{ fontSize: compact ? 17 : 18, fontWeight: 900, marginTop: 4 }}>{item.title}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {item.amountLabel ? <div style={pill}>{item.amountLabel}</div> : null}
          <div style={stateStyle}>{item.state}</div>
        </div>
      </div>
      <div style={{ marginTop: 8, color: "rgba(227,240,255,.76)", lineHeight: 1.48 }}>{item.body}</div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "rgba(227,240,255,.62)" }}>
          {meta.icon} {meta.title} • score {item.score}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="tabBtn" onClick={() => onNavigate?.(item.panelId)}>{item.actionLabel || `Open ${meta.title}`}</button>
        </div>
      </div>
    </div>
  );
}

const radarHeroGrid: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, .8fr)",
};

const radarMiniGrid: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  alignContent: "start",
};

const shell: React.CSSProperties = {
  display: "grid",
  gap: 12,
  color: "#eef7ff",
};

const heroCard: React.CSSProperties = {
  border: "1px solid rgba(120,180,255,.18)",
  borderRadius: 18,
  padding: 14,
  background: "linear-gradient(180deg, rgba(9,16,30,.94), rgba(8,14,22,.82))",
  boxShadow: "0 18px 50px rgba(0,0,0,.24)",
  display: "grid",
  gap: 12,
};

const mainCard: React.CSSProperties = {
  border: "1px solid rgba(120,180,255,.18)",
  borderRadius: 18,
  padding: 14,
  background: "rgba(8,14,22,.86)",
  boxShadow: "0 18px 50px rgba(0,0,0,.18)",
  display: "grid",
  gap: 12,
};

const topRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const bestMoveRow: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "1.2fr .8fr",
};

const bestMoveCard: React.CSSProperties = {
  border: "1px solid rgba(120,180,255,.14)",
  borderRadius: 16,
  padding: 12,
  background: "rgba(13,21,34,.82)",
};

const homieCard: React.CSSProperties = {
  border: "1px solid rgba(120,180,255,.14)",
  borderRadius: 16,
  padding: 12,
  background: "rgba(13,21,34,.82)",
};

const bucketCard: React.CSSProperties = {
  border: "1px solid rgba(120,180,255,.14)",
  borderRadius: 16,
  padding: 12,
  background: "rgba(10,16,28,.9)",
};

const decisionGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 10,
};

const domainGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 10,
};

const domainCardButton: React.CSSProperties = {
  textAlign: "left",
  border: "1px solid rgba(120,180,255,.16)",
  borderRadius: 16,
  padding: 12,
  background: "rgba(10,16,28,.9)",
  color: "#eef7ff",
  cursor: "pointer",
};

const statsRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 10,
};

const statCard: React.CSSProperties = {
  border: "1px solid rgba(120,180,255,.14)",
  borderRadius: 14,
  padding: 12,
  background: "rgba(12,20,32,.82)",
};

const tabRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const miniCard: React.CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(120,160,255,.18)",
  background: "rgba(8,16,32,.46)",
  padding: 12,
};

const itemCard: React.CSSProperties = {
  border: "1px solid rgba(120,180,255,.14)",
  borderRadius: 16,
  background: "rgba(10,16,28,.9)",
};

const loadingCard: React.CSSProperties = {
  border: "1px dashed rgba(120,180,255,.18)",
  borderRadius: 14,
  padding: 14,
  color: "rgba(227,240,255,.74)",
  background: "rgba(9,15,25,.62)",
};

const errorCard: React.CSSProperties = {
  border: "1px solid rgba(255,120,120,.25)",
  borderRadius: 14,
  padding: 12,
  background: "rgba(46,11,15,.65)",
  color: "#ffd7db",
};

const pill: React.CSSProperties = {
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 11,
  letterSpacing: ".05em",
  textTransform: "uppercase",
  border: "1px solid rgba(120,180,255,.18)",
  background: "rgba(12,20,32,.84)",
};

const pillWide: React.CSSProperties = {
  ...pill,
  marginTop: 10,
  display: "inline-flex",
};

const eyebrow: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "rgba(227,240,255,.56)",
};

const headline: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  lineHeight: 1.1,
  marginTop: 4,
};

const subline: React.CSSProperties = {
  marginTop: 8,
  color: "rgba(227,240,255,.76)",
  maxWidth: 820,
  lineHeight: 1.45,
};

const queuedPill: React.CSSProperties = {
  ...pill,
  color: "#dcefff",
};

const activePill: React.CSSProperties = {
  ...pill,
  color: "#c6ffdc",
  border: "1px solid rgba(114,255,164,.22)",
};

const blockedPill: React.CSSProperties = {
  ...pill,
  color: "#ffd7db",
  border: "1px solid rgba(255,120,120,.24)",
};

const donePill: React.CSSProperties = {
  ...pill,
  color: "#ffe9bc",
  border: "1px solid rgba(255,208,120,.2)",
};

const metricRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
  marginTop: 10,
};

const miniMetric: React.CSSProperties = {
  border: "1px solid rgba(120,180,255,.12)",
  borderRadius: 12,
  padding: 8,
  background: "rgba(12,20,32,.52)",
};

const modeRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};
