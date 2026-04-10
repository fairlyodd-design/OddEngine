import React, { useEffect, useMemo, useState } from "react";
import {
  BRAIN_INBOX_KEY,
  PANEL_META,
  buildActionQueue,
  buildAssistantInsight,
  buildDailyDigest,
  buildMorningDigest,
  buildOperatorFeed,
  buildPanelHealth,
  buildTopPriorities,
  getActionHistory,
  getBrainMemories,
  getBrainNotes,
  getGoals,
  getPanelMeta,
  readPanelContext,
  runBrainChat,
  runQuickAction,
  saveBrainNote,
  saveGoals,
  type BrainNote,
} from "../lib/brain";
import { getPanelAutomationSettings, savePanelAutomationSettings, type PanelAutomationSettings } from "../lib/automation";
import { executeCommand } from "../lib/commandCenter";
import { UPGRADE_PACKS_EVENT, getInjectedBrainCards, getUpgradePackHistory, grantAllUpgradePackPermissions, installUpgradePack, repairUpgradePackDependencies, type UpgradeSurfaceAction } from "../lib/plugins";
import { VOICE_ENGINE_EVENT, getVoiceEngineBadges, loadVoiceEngineSnapshot, summarizeVoiceEngine, type VoiceEngineSnapshot } from "../lib/voice";
import { PanelHeader } from "../components/PanelHeader";
import ActionMenu from "../components/ActionMenu";
import { PanelScheduleCard } from "../components/PanelScheduleCard";

export default function Brain({ onNavigate, activePanelId }: { onNavigate?: (panelId: string) => void; activePanelId?: string }) {
  const [targetPanel, setTargetPanel] = useState<string>(activePanelId || "Trading");
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [goals, setGoals] = useState<string>(() => getGoals());
  const [notes, setNotes] = useState<BrainNote[]>(() => getBrainNotes());
  const [tick, setTick] = useState(0);
  const [pluginTick, setPluginTick] = useState(0);
  const [panelAutos, setPanelAutos] = useState<PanelAutomationSettings>(() => getPanelAutomationSettings());
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceEngineSnapshot>(() => loadVoiceEngineSnapshot());
  const [view, setView] = useState<"overview" | "router" | "notes" | "systems">("overview");

  useEffect(() => {
    const id = window.setInterval(() => {
      setNotes(getBrainNotes());
      setTick((v) => v + 1);
    }, 2500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = () => setPluginTick((v) => v + 1);
    window.addEventListener(UPGRADE_PACKS_EVENT, handler as EventListener);
    return () => window.removeEventListener(UPGRADE_PACKS_EVENT, handler as EventListener);
  }, []);
  useEffect(() => {
    const refreshVoice = () => setVoiceSnapshot(loadVoiceEngineSnapshot());
    window.addEventListener(VOICE_ENGINE_EVENT, refreshVoice as EventListener);
    window.addEventListener("storage", refreshVoice as EventListener);
    return () => {
      window.removeEventListener(VOICE_ENGINE_EVENT, refreshVoice as EventListener);
      window.removeEventListener("storage", refreshVoice as EventListener);
    };
  }, []);


  useEffect(() => {
    try {
      const raw = localStorage.getItem(BRAIN_INBOX_KEY);
      if (!raw) return;
      const inbox = JSON.parse(raw) as { text?: string };
      if (inbox?.text) {
        setPrompt(inbox.text);
        localStorage.removeItem(BRAIN_INBOX_KEY);
      }
    } catch {}
  }, []);

  const morningDigest = useMemo(() => buildMorningDigest(), [tick]);
  const dailyDigest = useMemo(() => buildDailyDigest(), [tick]);
  const topPriorities = useMemo(() => buildTopPriorities(6), [tick]);
  const actionQueue = useMemo(() => buildActionQueue(7), [tick]);
  const healthIds = ["Trading", "FamilyBudget", "Grow", "News", "FamilyHealth", "GroceryMeals", "Security", "Money", "OptionsSaaS", "DevEngine", "OddBrain"];
  const panelHealth = useMemo(() => buildPanelHealth(healthIds), [tick]);
  const operatorFeed = useMemo(() => buildOperatorFeed(10), [tick]);
  const memories = useMemo(() => getBrainMemories().slice(0, 8), [tick]);
  const actions = useMemo(() => getActionHistory().slice(0, 8), [tick]);
  const focusPanels = useMemo(
    () => ["Trading", "FamilyBudget", "Grow", "News", "FamilyHealth", "GroceryMeals", "Money", "Security", "DevEngine"].map((id) => ({ ctx: readPanelContext(id), insight: buildAssistantInsight(id) })),
    [tick]
  );
  const targetMeta = getPanelMeta(targetPanel);
  const targetInsight = useMemo(() => buildAssistantInsight(targetPanel), [targetPanel, tick]);
  const goalCount = goals.split(/\n+/).filter(Boolean).length;
  const avgHealth = panelHealth.length ? Math.round(panelHealth.reduce((sum, item) => sum + item.score, 0) / panelHealth.length) : 0;
  const brainCards = useMemo(() => getInjectedBrainCards(), [pluginTick]);
  const pluginHistory = useMemo(() => getUpgradePackHistory().slice(0, 8), [pluginTick]);

  async function askBrain(forcePrompt?: string) {
    const text = (forcePrompt ?? prompt).trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const r = await runBrainChat({ panelId: targetPanel, prompt: text, mode: "brain" });
      setReply(r.reply);
      saveBrainNote({ panelId: targetPanel, title: `${targetMeta.title} routed summary`, body: r.reply, pinned: true });
      setNotes(getBrainNotes());
      if (!forcePrompt) setPrompt("");
      setTick((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }

  function saveGoalState() {
    saveGoals(goals);
    setTick((v) => v + 1);
  }

  function saveAutoSettings(next: PanelAutomationSettings) {
    setPanelAutos(next);
    savePanelAutomationSettings(next);
    setTick((v) => v + 1);
  }

  function runAction(actionId?: string) {
    if (!actionId) return;
    const result = runQuickAction(actionId);
    if (result.panelId) onNavigate?.(result.panelId);
    if (result.message) setReply(result.message);
    setTick((v) => v + 1);
  }

  function handlePluginCardAction(action: UpgradeSurfaceAction) {
    if (action.kind === "install-pack") {
      const packId = action.id.split(":")[0];
      installUpgradePack(packId);
      setReply(`${action.label} complete.`);
      setPluginTick((v) => v + 1);
      return;
    }
    if (action.kind === "grant-permissions") {
      const packId = action.id.split(":")[0];
      grantAllUpgradePackPermissions(packId);
      setReply(`${action.label} complete.`);
      setPluginTick((v) => v + 1);
      return;
    }
    if (action.kind === "repair-dependencies") {
      const packId = action.id.split(":")[0];
      repairUpgradePackDependencies(packId);
      setReply(`${action.label} complete.`);
      setPluginTick((v) => v + 1);
      return;
    }
    if (action.kind === "navigate" && action.panelId) {
      onNavigate?.(action.panelId);
      if (action.speakText) setReply(action.speakText);
      return;
    }
    if (action.kind === "command" && action.commandText) {
      const result = executeCommand({
        text: action.commandText,
        activePanelId: "Brain",
        onNavigate: (id) => onNavigate?.(id),
        onStatus: (text) => setReply(text),
      });
      if (result?.message && !action.speakText) setReply(result.message);
      if (action.speakText) setReply(action.speakText);
      setTick((v) => v + 1);
    }
  }

  return (
    <div className="page">
      <PanelHeader
        panelId="Brain"
        title="🧠 Brain Mission Control"
        subtitle="Mission Control • AI Operator"
        badges={[
          { label: `Health ${avgHealth}/100`, tone: avgHealth >= 74 ? "good" : avgHealth >= 45 ? "warn" : "bad" },
          { label: `${actionQueue.length} queued`, tone: actionQueue.length ? "good" : "muted" },
          { label: `${goalCount} goals`, tone: goalCount ? "good" : "muted" },
          { label: `Voice ${voiceSnapshot.cloudState}`, tone: voiceSnapshot.cloudState === "ready" ? "good" : voiceSnapshot.cloudState === "degraded" ? "warn" : "bad" },
        ]}
        rightSlot={
          <ActionMenu
            items={[
              { label: "Refresh mission data", onClick: () => setTick((v) => v + 1) },
              { label: "Pin morning digest", onClick: () => runAction("brain:pin-digest") },
              { label: "Run next queued action", onClick: () => runAction("brain:run-next-queue") },
              { label: "Open Calendar", onClick: () => onNavigate?.("Calendar") },
            ]}
          />
        }
      />

      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button className={`tabBtn ${view === "overview" ? "active" : ""}`} onClick={() => setView("overview")}>Overview</button>
        <button className={`tabBtn ${view === "router" ? "active" : ""}`} onClick={() => setView("router")}>Router</button>
        <button className={`tabBtn ${view === "notes" ? "active" : ""}`} onClick={() => setView("notes")}>Notes</button>
        <button className={`tabBtn ${view === "systems" ? "active" : ""}`} onClick={() => setView("systems")}>Systems</button>
      </div>

      {view === "overview" ? (
        <>
      <div className="card heroCard missionHero">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="small shellEyebrow">MISSION CONTROL • AI OPERATOR</div>
            <div className="h">🧠 Brain Mission Control</div>
            <div className="sub">Morning digest, top priorities, runnable action queue, panel health, the AI operator feed, and automation controls.</div>
          </div>
          <div className="shellStats">
            <div className="statPill"><b>{avgHealth}</b><span>avg health</span></div>
            <div className="statPill"><b>{actionQueue.length}</b><span>queued moves</span></div>
            <div className="statPill"><b>{goalCount}</b><span>active goals</span></div>
            <div className="statPill"><b>{operatorFeed.length}</b><span>operator feed</span></div>
          </div>
        </div>
        <div className="assistantChipWrap" style={{ marginTop: 12 }}>
          <span className={`badge ${avgHealth >= 74 ? "good" : avgHealth >= 45 ? "warn" : "bad"}`}>OS health {avgHealth}/100</span>
          <span className={`badge ${topPriorities[0]?.level === "error" ? "bad" : topPriorities[0]?.level === "warn" ? "warn" : "good"}`}>
            {topPriorities[0] ? `${getPanelMeta(topPriorities[0].panelId).title} first` : "No urgent priorities"}
          </span>
          <span className={`badge ${notes.length ? "good" : "muted"}`}>{notes.length} notes</span>
          <span className={`badge ${voiceSnapshot.cloudState === "ready" ? "good" : voiceSnapshot.cloudState === "degraded" ? "warn" : "bad"}`}>voice {voiceSnapshot.cloudState}</span>
        </div>
        <div className="row" style={{ justifyContent: "space-between", marginTop: 14, gap: 10, flexWrap: "wrap" }}>
          <div className="small" style={{ maxWidth: 780 }}>Mission Control keeps the working panels pointed at the most important next action instead of just showing advice.</div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="tabBtn" onClick={() => setTick((v) => v + 1)}>Refresh mission data</button>
            <button className="tabBtn" onClick={() => runAction("brain:pin-digest")}>Pin morning digest</button>
            <button onClick={() => runAction("brain:run-next-queue")}>Run next queued action</button>
          </div>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <PanelScheduleCard
          title="Ops schedule"
          subtitle="Quick-add reminders + upcoming items across the OS."
          showAllUpcoming
          onNavigate={onNavigate}
          presets={[
            { label: "+ Morning brief", title: "Morning brief", time: "08:30", notes: "News → Brain → Trading plan" },
            { label: "+ Midday check", title: "Midday check-in", time: "12:00", notes: "Scan → adjust plan" },
            { label: "+ Budget review", title: "Budget review", time: "17:30" },
            { label: "+ Grow check", title: "Grow room check", time: "19:30" },
          ]}
        />
        <div className="card softCard">
          <div className="h">Quick links</div>
          <div className="sub">Jump straight into the lane you need.</div>
          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            <button className="tabBtn" onClick={() => onNavigate?.("Trading")}>Open Trading</button>
            <button className="tabBtn" onClick={() => onNavigate?.("News")}>Open News</button>
            <button className="tabBtn" onClick={() => onNavigate?.("Grow")}>Open Grow</button>
            <button className="tabBtn" onClick={() => onNavigate?.("FamilyBudget")}>Open Budget</button>
            <button className="tabBtn active" onClick={() => onNavigate?.("Calendar")}>Open Calendar</button>
          </div>
          <div className="small" style={{ marginTop: 10, opacity: 0.9 }}>
            Tip: Use the Router tab to ask Brain questions *as* a specific panel specialist.
          </div>
        </div>
      </div>

        </>
      ) : null}

      {view === "systems" && !!brainCards.length && (
        <div className="card softCard">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div className="h">Plugin-upgraded copilots</div>
              <div className="sub">Installed packs now inject cards directly into Mission Control so Brain can run them, grant permissions, and surface upgrade opportunities.</div>
            </div>
            <span className="badge good">{brainCards.length} plugin cards</span>
          </div>
          <div className="quickActionGrid" style={{ marginTop: 12 }}>
            {brainCards.map((card) => (
              <div key={card.id} className={`card softCard pluginUpgradeCard ${card.tone || "good"}`}>
                {card.eyebrow ? <div className="small pluginCardEyebrow">{card.eyebrow}</div> : null}
                <div style={{ fontWeight: 900, marginTop: 4 }}>{card.title}</div>
                <div className="small" style={{ marginTop: 8, lineHeight: 1.45 }}>{card.body}</div>
                <div className="assistantChipWrap">
                  {card.actions.map((action) => (
                    <button key={action.id} className={`tabBtn ${action.tone === "good" ? "active" : ""}`} onClick={() => handlePluginCardAction(action)}>{action.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "systems" ? (
      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card softCard">
          <div className="h">Plugin maintenance history</div>
          <div className="sub">Recent upgrade-bay installs, updates, permission grants, and dependency repairs surfaced into Mission Control.</div>
          <div className="assistantStack" style={{ marginTop: 12 }}>
            {pluginHistory.length === 0 && <div className="small">No plugin maintenance history yet.</div>}
            {pluginHistory.map((entry) => (
              <div key={entry.id} className="timelineCard" style={{ background: "rgba(8,12,18,0.34)" }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900 }}>{entry.packName}</div>
                  <span className={`badge ${entry.status === "success" ? "good" : entry.status === "warn" ? "warn" : "muted"}`}>{entry.action}</span>
                </div>
                <div className="small" style={{ marginTop: 6 }}>{entry.detail}</div>
                <div className="small" style={{ marginTop: 6 }}>{new Date(entry.at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card softCard">
          <div className="h">Voice engine status</div>
          <div className="sub">Mission Control now shows Homie’s live voice lane so network/service issues are visible before they slow you down.</div>
          <div className="assistantChipWrap" style={{ marginTop: 12 }}>
            {getVoiceEngineBadges(voiceSnapshot).map((badge) => (
              <span key={badge.label} className={`badge ${badge.tone}`}>{badge.label}</span>
            ))}
          </div>
          <div className="small" style={{ marginTop: 10 }}>{summarizeVoiceEngine(voiceSnapshot)}</div>
          <div className="small" style={{ marginTop: 6 }}>Mic permission: <b>{voiceSnapshot.permissionState}</b> • Inputs: <b>{voiceSnapshot.audioInputCount}</b></div>
        </div>

      </div>
      ) : null}

      {view === "overview" ? (
      <div className="card softCard">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div className="h">Focus lanes</div>
            <div className="sub">FairlyOdd Mission Control now highlights the strongest operational lanes first so Brain can route you fast.</div>
          </div>
          <span className="badge good">Trading • Budget • Grow • Operator</span>
        </div>
        <div className="quickActionGrid" style={{ marginTop: 12 }}>
          {focusPanels.slice(0, 4).map(({ ctx, insight }) => (
            <div key={ctx.panelId} className="card spotlightCard">
              <div className="small shellEyebrow">{ctx.meta.section || "CORE"}</div>
              <div style={{ fontWeight: 900, fontSize: 18, marginTop: 4 }}>{ctx.meta.icon} {ctx.meta.title}</div>
              <div className="small" style={{ marginTop: 8, lineHeight: 1.45 }}>{insight.headline}</div>
              <div className="assistantChipWrap">
                {insight.badges.slice(0, 3).map((badge) => <span key={`${ctx.panelId}-${badge.label}`} className={`badge ${badge.tone}`}>{badge.label}</span>)}
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <button className="tabBtn active" onClick={() => onNavigate?.(ctx.panelId)}>Open lane</button>
                <button className="tabBtn" onClick={() => askBrain(`Use Mission Control to build a one-screen operating plan for ${getPanelMeta(ctx.panelId).title}.`)}>Brief me</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      ) : null}

      {view === "overview" ? (
      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card softCard">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div className="h">Morning digest</div>
              <div className="sub">Your AI morning briefing across the strongest operational panels.</div>
            </div>
            <button className="tabBtn" onClick={() => askBrain("Use Mission Control to turn this morning digest into a focused work order for today.")}>Turn into work order</button>
          </div>
          <div className="small" style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, marginTop: 10 }}>{morningDigest}</div>
        </div>

        <div className="card softCard">
          <div className="h">Top priorities</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {topPriorities.map((item, idx) => (
              <div key={item.id} className={`missionCard ${item.level}`}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div className="small">#{idx + 1} • {getPanelMeta(item.panelId).title}</div>
                    <div style={{ fontWeight: 800, marginTop: 4 }}>{item.title}</div>
                  </div>
                  <span className={`badge ${item.level === "error" ? "bad" : item.level === "warn" ? "warn" : "good"}`}>{item.level}</span>
                </div>
                <div className="small" style={{ marginTop: 6 }}>{item.text}</div>
                <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                  <button className="tabBtn" onClick={() => onNavigate?.(item.panelId)}>Open {getPanelMeta(item.panelId).title}</button>
                  {item.actionId && <button className="tabBtn active" onClick={() => runAction(item.actionId)}>{item.actionLabel || "Run"}</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      ) : null}

      {view === "overview" ? (
      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card softCard">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div className="h">Action queue</div>
              <div className="sub">Runnable actions sorted by urgency and operational value.</div>
            </div>
            <button className="tabBtn" onClick={() => runAction("brain:run-next-queue")}>Run top action</button>
          </div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {actionQueue.map((item, idx) => (
              <div key={item.id} className="timelineCard">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div className="small">Queue #{idx + 1} • {getPanelMeta(item.panelId).title}</div>
                    <div style={{ fontWeight: 800, marginTop: 4 }}>{item.title}</div>
                  </div>
                  <span className={`badge ${item.level === "error" ? "bad" : item.level === "warn" ? "warn" : "good"}`}>{item.score}</span>
                </div>
                <div className="small" style={{ marginTop: 6 }}>{item.body}</div>
                <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                  {item.actionId && <button className="tabBtn active" onClick={() => runAction(item.actionId)}>{item.actionLabel || "Run action"}</button>}
                  <button className="tabBtn" onClick={() => onNavigate?.(item.panelId)}>Open panel</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card softCard">
          <div className="h">Panel health</div>
          <div className="sub">Scorecards for the panels that drive the most real work right now.</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {panelHealth.map((item) => (
              <div key={item.panelId} className="timelineCard" onClick={() => onNavigate?.(item.panelId)}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div className="small">{item.icon} {item.title}</div>
                    <div style={{ fontWeight: 800, marginTop: 4 }}>{item.headline}</div>
                  </div>
                  <span className={`badge ${item.status === "error" ? "bad" : item.status === "warn" ? "warn" : "good"}`}>{item.score}/100</span>
                </div>
                <div className="healthBar" style={{ marginTop: 10 }}><div className={`healthFill ${item.status}`} style={{ width: `${item.score}%` }} /></div>
                <div className="assistantChipWrap" style={{ marginTop: 10 }}>
                  {item.badges.map((badge) => <span key={badge.label} className={`badge ${badge.tone}`}>{badge.label}</span>)}
                </div>
                {!!item.reasons.length && <div className="small" style={{ marginTop: 8 }}>{item.reasons.join(" • ")}</div>}
                {item.nextActionId && (
                  <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                    <button className="tabBtn" onClick={(e) => { e.stopPropagation(); runAction(item.nextActionId); }}>{item.nextActionLabel || "Run next action"}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      ) : null}

      {view === "overview" ? (
      <div className="card softCard">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div className="h">AI operator feed</div>
            <div className="sub">A blended stream of confirmed actions, memories, activity, notifications, and missions.</div>
          </div>
          <button className="tabBtn" onClick={() => askBrain("Read the AI operator feed and tell me the most important pattern, blocker, and next move.")}>Summarize feed</button>
        </div>
        <div className="grid2" style={{ marginTop: 10, alignItems: "start" }}>
          <div className="assistantStack">
            {operatorFeed.map((item) => (
              <div key={item.id} className="timelineCard" onClick={() => onNavigate?.(item.panelId)}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div className="small">{getPanelMeta(item.panelId).title} • {item.source}</div>
                    <div style={{ fontWeight: 800, marginTop: 4 }}>{item.title}</div>
                  </div>
                  <span className={`badge ${item.level === "error" ? "bad" : item.level === "warn" ? "warn" : item.level === "good" ? "good" : "muted"}`}>{item.level}</span>
                </div>
                <div className="small" style={{ marginTop: 6 }}>{item.body}</div>
              </div>
            ))}
          </div>
          <div className="assistantStack">
            <div className="timelineCard">
              <div style={{ fontWeight: 800 }}>Deep digest</div>
              <div className="small" style={{ whiteSpace: "pre-wrap", lineHeight: 1.45, marginTop: 8 }}>{dailyDigest}</div>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {(view === "notes" || view === "systems") ? (
      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card softCard">
          <div className="h">Saved goals</div>
          <div className="sub">These goals get injected into panel copilots, Brain routing, and Mission Control priorities.</div>
          {view !== "notes" ? (
            <div className="small" style={{ marginTop: 10, opacity: 0.85 }}>
              Switch to <b>Notes</b> tab to edit goals.
              <button className="tabBtn" style={{ marginLeft: 8 }} onClick={() => setView("notes")}>Open Notes</button>
            </div>
          ) : null}
          <textarea disabled={view !== "notes"} rows={8} value={goals} onChange={(e) => setGoals(e.target.value)} placeholder={`Examples:\n- Keep OddEngine stable before heavy new features\n- Focus on trading, family budget, grow ops, and family care first\n- Package clean zips with local-only safety`} style={{ marginTop: 10 }} />
          <div className="row" style={{ justifyContent: "space-between", marginTop: 10, flexWrap: "wrap" }}>
            <div className="small">{goalCount} active goal lines</div>
            <div className="row" style={{ gap: 8 }}>
              <button className="tabBtn" disabled={view !== "notes"} onClick={() => setGoals("- Stabilize the shell\n- Improve AI copilots\n- Ship polished builds\n- Keep family planning panels current")}>Seed starter goals</button>
              <button disabled={view !== "notes"} onClick={saveGoalState}>Save goals</button>
            </div>
          </div>
        </div>

        <div className="card softCard">
          <div className="h">Mission Control automations</div>
          <div className="sub">Digest scheduling, news refresh nudges, and panel reminders run while OddEngine is open.</div>
          {view !== "systems" ? (
            <div className="small" style={{ marginTop: 10, opacity: 0.85 }}>
              Switch to <b>Systems</b> tab to edit automations.
              <button className="tabBtn" style={{ marginLeft: 8 }} onClick={() => setView("systems")}>Open Systems</button>
            </div>
          ) : null}
          <div className="assistantStack" style={{ marginTop: 12 }}>
            <label className="timelineCard" style={{ cursor: "default" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>Scheduled daily digest</div>
                  <div className="small" style={{ marginTop: 4 }}>Generate and pin a morning digest automatically.</div>
                </div>
                <input disabled={view !== "systems"} type="checkbox" checked={panelAutos.scheduledDailyDigest} onChange={(e) => saveAutoSettings({ ...panelAutos, scheduledDailyDigest: e.target.checked })} />
              </div>
            </label>
            <label className="timelineCard" style={{ cursor: "default" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>Digest minute of day</div>
                  <div className="small" style={{ marginTop: 4 }}>Example: 480 = 8:00 AM, 540 = 9:00 AM.</div>
                </div>
                <input disabled={view !== "systems"} style={{ width: 120 }} type="number" min={0} max={1439} value={panelAutos.digestMinute} onChange={(e) => saveAutoSettings({ ...panelAutos, digestMinute: Math.max(0, Math.min(1439, Number(e.target.value || 0))) })} />
              </div>
            </label>
            <label className="timelineCard" style={{ cursor: "default" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>News refresh prompt</div>
                  <div className="small" style={{ marginTop: 4 }}>Warn when the News desk is stale and queue a refresh.</div>
                </div>
                <input disabled={view !== "systems"} type="checkbox" checked={panelAutos.newsRefreshPrompt} onChange={(e) => saveAutoSettings({ ...panelAutos, newsRefreshPrompt: e.target.checked })} />
              </div>
            </label>
            <label className="timelineCard" style={{ cursor: "default" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>Trading refresh prompt</div>
                  <div className="small" style={{ marginTop: 4 }}>Warn when a ticker is active but no chain is loaded.</div>
                </div>
                <input disabled={view !== "systems"} type="checkbox" checked={panelAutos.tradingRefreshPrompt} onChange={(e) => saveAutoSettings({ ...panelAutos, tradingRefreshPrompt: e.target.checked })} />
              </div>
            </label>
            <label className="timelineCard" style={{ cursor: "default" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>Budget sync check</div>
                  <div className="small" style={{ marginTop: 4 }}>Warn when the backend bridge is stale or throwing errors.</div>
                </div>
                <input disabled={view !== "systems"} type="checkbox" checked={panelAutos.budgetSyncCheck} onChange={(e) => saveAutoSettings({ ...panelAutos, budgetSyncCheck: e.target.checked })} />
              </div>
            </label>
            <label className="timelineCard" style={{ cursor: "default" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>Grow reminder</div>
                  <div className="small" style={{ marginTop: 4 }}>Warn when a room has no baseline reading or readings are stale.</div>
                </div>
                <input disabled={view !== "systems"} type="checkbox" checked={panelAutos.growReminder} onChange={(e) => saveAutoSettings({ ...panelAutos, growReminder: e.target.checked })} />
              </div>
            </label>
          </div>
        </div>
      </div>
      ) : null}

      {view === "router" ? (
      <div className="card softCard">
        <div className="h">Specialist router</div>
        <div className="sub">Choose a target panel, ask a question, and Brain routes through that specialist with live local context attached.</div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <label className="field">Target specialist
            <select value={targetPanel} onChange={(e) => setTargetPanel(e.target.value)}>
              {PANEL_META.map((meta) => <option key={meta.id} value={meta.id}>{meta.icon} {meta.title} — {meta.assistantName}</option>)}
            </select>
          </label>
          <div className="field">
            <div className="sub" style={{ marginBottom: 6 }}>{targetMeta.assistantName}</div>
            <div className="card" style={{ background: "rgba(0,0,0,0.16)", minHeight: 88 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 800 }}>{targetMeta.title}</div>
                <span className={`badge ${targetInsight.tone === "bad" ? "bad" : targetInsight.tone === "warn" ? "warn" : "good"}`}>{targetInsight.tone}</span>
              </div>
              <div className="small" style={{ marginTop: 8 }}>{readPanelContext(targetPanel).summary}</div>
              <div className="assistantChipWrap" style={{ marginTop: 10 }}>
                {targetInsight.badges.map((badge) => <span key={badge.label} className={`badge ${badge.tone}`}>{badge.label}</span>)}
              </div>
            </div>
          </div>
        </div>
        <textarea rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask Brain to compare panels, prioritize work, explain risks, or turn Mission Control into a next-step plan..." style={{ marginTop: 10 }} />
        <div className="row" style={{ justifyContent: "space-between", marginTop: 10, flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {["Give me a cross-panel digest.", "Turn Mission Control into a work order.", "Where are the biggest risks?", "What should I build next?"].map((qp) => (
              <button key={qp} className="tabBtn" onClick={() => askBrain(qp)}>{qp}</button>
            ))}
          </div>
          <button onClick={() => askBrain()} disabled={busy || !prompt.trim()}>{busy ? "Thinking…" : "Ask Brain"}</button>
        </div>
        {reply && (
          <div className="card softCard" style={{ marginTop: 12 }}>
            <div className="assistantSectionTitle">Brain reply</div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, marginTop: 8 }}>{reply}</div>
          </div>
        )}
      </div>
      ) : null}

      {view === "notes" ? (
      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card softCard">
          <div className="h">Cross-panel snapshots</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {focusPanels.map(({ ctx, insight }) => (
              <div key={ctx.panelId} className="timelineCard" onClick={() => onNavigate?.(ctx.panelId)}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div className="small">{ctx.meta.section}</div>
                    <div style={{ fontWeight: 800, marginTop: 4 }}>{ctx.meta.icon} {ctx.meta.title}</div>
                  </div>
                  <span className={`badge ${insight.tone === "bad" ? "bad" : insight.tone === "warn" ? "warn" : "good"}`}>{insight.tone}</span>
                </div>
                <div className="small" style={{ marginTop: 6 }}>{insight.headline}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card softCard">
          <div className="h">Pinned notes + confirmed actions</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {notes.slice(0, 4).map((note) => (
              <div key={note.id} className="timelineCard" onClick={() => onNavigate?.(note.panelId)}>
                <div className="small">{getPanelMeta(note.panelId).title}</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>{note.title}</div>
                <div className="small" style={{ marginTop: 6 }}>{note.body.slice(0, 180)}{note.body.length > 180 ? "…" : ""}</div>
              </div>
            ))}
            {actions.slice(0, 4).map((item) => (
              <div key={item.id} className="timelineCard" onClick={() => onNavigate?.(item.panelId)}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div className="small">{getPanelMeta(item.panelId).title}</div>
                    <div style={{ fontWeight: 800, marginTop: 4 }}>{item.title}</div>
                  </div>
                  <span className={`badge ${item.status === "error" ? "bad" : item.status === "warn" ? "warn" : item.status === "success" ? "good" : "muted"}`}>{item.undoneAt ? "undone" : item.status}</span>
                </div>
                <div className="small" style={{ marginTop: 6 }}>{item.body}</div>
              </div>
            ))}
            {!notes.length && !actions.length && <div className="small">No notes or confirmed actions yet.</div>}
          </div>
        </div>
      </div>
      ) : null}

      {view === "notes" && memories.length > 0 && (
        <div className="card softCard">
          <div className="h">Cross-panel memory</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {memories.map((item) => (
              <div key={item.id} className="timelineCard" onClick={() => onNavigate?.(item.panelId)}>
                <div className="small">{getPanelMeta(item.panelId).title}</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>{item.title}</div>
                <div className="small" style={{ marginTop: 6 }}>{item.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
